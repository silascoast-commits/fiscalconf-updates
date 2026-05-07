# =============================================================================
#  robo_giss.py  —  GissBot — GissOnline com CapSolver
#  v5 — Fix principal: aguarda QWERTY fechar antes de capturar CAPTCHA
#
#  CAUSA RAIZ dos erros anteriores:
#  - O bot capturava a imagem do CAPTCHA enquanto o teclado QWERTY ainda
#    estava aberto na tela, obtendo a linha numerica do QWERTY (3 4 5 6...)
#    em vez do CAPTCHA real (2020). O CapSolver rejeitava com "task expired".
#  - Fix: page.wait_for_selector("Aceitar", state="hidden") garante que o
#    QWERTY fechou completamente antes de qualquer outra acao.
# =============================================================================

from pathlib import Path
from datetime import datetime
import re
import time
import os
import base64
import requests

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ---------------------------------------------------------------------------
# 2captcha — resolve CAPTCHA de imagem numerica
# Cadastro: https://2captcha.com  |  Custo: ~U$ 0,001 por CAPTCHA
# Coloque sua chave abaixo ou defina a variavel de ambiente CAPTCHA2_KEY
# ---------------------------------------------------------------------------
CAPTCHA2_API_KEY = os.environ.get("CAPTCHA2_KEY", "2feea3e8e490d2761fb91f623e3db275")
CAPTCHA2_IN_URL  = "https://2captcha.com/in.php"
CAPTCHA2_RES_URL = "https://2captcha.com/res.php"

try:
    from playwright_stealth import stealth_sync
    STEALTH_DISPONIVEL = True
except ImportError:
    STEALTH_DISPONIVEL = False


# ===========================================================================
class CaptchaClient:
    """
    Cliente para o 2captcha.com - resolve CAPTCHA de imagem numerica.
    API simples: envia imagem em base64, recebe os digitos resolvidos.
    """
# ===========================================================================

    def __init__(self, api_key):
        self.api_key = api_key

    def verificar_saldo(self):
        try:
            resp = requests.get(
                CAPTCHA2_RES_URL,
                params={"key": self.api_key, "action": "getbalance", "json": 1},
                timeout=15
            )
            data = resp.json()
            if data.get("status") == 1:
                return float(data.get("request", 0))
            raise RuntimeError("2captcha getbalance: {}".format(data.get("request", data)))
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError("2captcha verificar_saldo falhou: {}".format(e))

    def resolver_imagem(self, img_bytes):
        if not self.api_key or self.api_key == "SUA_CHAVE_2CAPTCHA_AQUI":
            raise RuntimeError(
                "Chave 2captcha nao configurada. "
                "Cadastre-se em https://2captcha.com, adicione saldo "
                "e cole sua chave em CAPTCHA2_API_KEY no topo do arquivo."
            )

        # Verifica saldo
        try:
            saldo = self.verificar_saldo()
            print("[2captcha] Saldo: U$ {:.4f}".format(saldo))
            if saldo <= 0:
                raise RuntimeError(
                    "Saldo 2captcha zerado (U$ {:.4f}). "
                    "Adicione creditos em https://2captcha.com.".format(saldo)
                )
        except RuntimeError:
            raise
        except Exception as e:
            print("[2captcha] Nao foi possivel verificar saldo: {}".format(e))

        # Upscale se necessario
        img_final = img_bytes
        try:
            from PIL import Image
            import io as _io
            img = Image.open(_io.BytesIO(img_bytes))
            if img.width < 80 or img.height < 20:
                fator = max(3, 150 // max(img.width, 1))
                img = img.resize((img.width * fator, img.height * fator), Image.LANCZOS)
                buf = _io.BytesIO()
                img.save(buf, format="PNG")
                img_final = buf.getvalue()
                print("[2captcha] Imagem ampliada para {}x{}.".format(img.width, img.height))
        except ImportError:
            pass
        except Exception as e:
            print("[2captcha] Aviso imagem: {}".format(e))

        b64 = base64.b64encode(img_final).decode("utf-8")

        # Envia imagem
        resp = requests.post(
            CAPTCHA2_IN_URL,
            data={
                "key":     self.api_key,
                "method":  "base64",
                "body":    b64,
                "json":    1,
                "numeric": 1,
                "min_len": 4,
                "max_len": 6,
            },
            timeout=30
        )
        data = resp.json()
        print("[2captcha] Submit: {}".format(data))

        if data.get("status") != 1:
            raise RuntimeError("2captcha submit erro: {}".format(data.get("request", data)))

        captcha_id = data["request"]
        print("[2captcha] ID: {}".format(captcha_id))

        # Poll resultado
        time.sleep(10)
        for poll in range(20):
            resp2 = requests.get(
                CAPTCHA2_RES_URL,
                params={"key": self.api_key, "action": "get", "id": captcha_id, "json": 1},
                timeout=15
            )
            d2 = resp2.json()
            print("[2captcha] Poll {}: {}".format(poll + 1, d2))

            if d2.get("status") == 1:
                texto   = str(d2.get("request", "")).strip()
                digitos = re.sub(r"[^0-9]", "", texto)
                print("[2captcha] Resolvido: '{}' -> digitos='{}'".format(texto, digitos))
                return digitos

            req = d2.get("request", "")
            if req == "ERROR_CAPTCHA_UNSOLVABLE":
                raise RuntimeError("2captcha: CAPTCHA insoluvel (imagem ilegivel).")
            if req not in ("CAPCHA_NOT_READY", "CAPTCHA_NOT_READY"):
                raise RuntimeError("2captcha erro: {}".format(req))

            time.sleep(5)

        raise RuntimeError("2captcha: timeout apos 20 polls.")


# ===========================================================================
class GissBot:
# ===========================================================================

    def __init__(self, config: dict):
        self.base_url     = config.get("base_url", "https://portal.gissonline.com.br/login/index.html")
        self.usuario      = config.get("usuario", "")
        self.senha        = config.get("senha", "")
        self.competencia  = config.get("competencia", "")
        self.cliente_nome = config.get("cliente_nome", "cliente")
        self.download_dir = Path(config.get("download_dir", "."))
        self.headless     = bool(config.get("headless", False))
        self.captcha_timeout_manual = int(config.get("captcha_timeout_manual", 300))
        self.estado       = config.get("estado", "SP")   # UF para tela de seleção de município
        self.municipio    = config.get("municipio", "")  # nome parcial do município (opcional)

        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.evidencias = []
        self.logs       = []
        self._paginas_novas = []  # abas abertas via window.open durante login

        partes = self.competencia.split("/")
        self.comp_mes = partes[0].strip().zfill(2) if len(partes) >= 1 else ""
        self.comp_ano = partes[1].strip()           if len(partes) >= 2 else ""

        self.captcha  = CaptchaClient(CAPTCHA2_API_KEY)

    # ------------------------------------------------------------------ #
    # Utilitarios                                                          #
    # ------------------------------------------------------------------ #

    def _stamp(self):
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    def _safe(self, txt):
        return re.sub(r"[^A-Za-z0-9_\-]+", "_", str(txt or "").strip())

    def _log(self, msg):
        linha = "[{}] {}".format(datetime.now().strftime("%d/%m/%Y %H:%M:%S"), msg)
        self.logs.append(linha)
        print(linha)

    def _save_txt(self, tipo, conteudo):
        nome = "{}_{}_{}_{}.txt".format(
            self._stamp(), self._safe(self.cliente_nome),
            self._safe(self.competencia), tipo)
        (self.download_dir / nome).write_text(conteudo, encoding="utf-8")
        self.evidencias.append(nome)

    def _shot(self, page, tipo):
        nome = "{}_{}_{}_{}.png".format(
            self._stamp(), self._safe(self.cliente_nome),
            self._safe(self.competencia), tipo)
        arq = self.download_dir / nome
        try:
            page.screenshot(path=str(arq), full_page=True)
            self.evidencias.append(arq.name)
            self._log("Screenshot: {}".format(arq.name))
        except Exception as e:
            self._log("[screenshot erro] {}".format(e))

    def _url_atual(self, page):
        try:
            return page.url.lower()
        except Exception:
            return ""

    def _eh_url_portal(self, url):
        """Verifica se a URL é o portal interno do GissOnline."""
        url = url.lower()
        return (
            "gissonline" in url and
            ("interna" in url or "default.cfm" in url) and
            "afterlogin"    not in url and
            "login/index"   not in url and
            "troca_senha"   not in url and
            "seleciona_est" not in url
        )

    def _eh_tela_selecao_municipio(self, url):
        url = url.lower()
        return "troca_senha" in url or "seleciona_estado" in url

    def _tratar_selecao_municipio(self, page):
        """
        Trata a tela obrigatória de seleção de estado/município que aparece
        após o login em portal.gissonline.com.br/troca_senha/seleciona_estado.cfm.

        Fluxo:
          1. Seleciona o estado no <select name="Estado">
          2. Aguarda o iframe 'cidades' carregar as cidades via AJAX
          3. Clica no primeiro link de cidade (ou no que corresponde a self.municipio)
             — cada link chama parent.enviaCidade(cidade, estado) que submete o form
          4. Aguarda redirect para o portal real (interna/default.cfm)
        """
        self._log("=== Tela de seleção de município detectada ===")
        self._shot(page, "selecao_municipio_inicio")

        estado = (self.estado or "SP").upper()
        self._log("Selecionando estado: {}".format(estado))

        # 1. Seleciona estado
        try:
            page.select_option("select[name='Estado']", value=estado, timeout=5000)
            self._log("Estado '{}' selecionado.".format(estado))
        except Exception as e:
            self._log("Erro ao selecionar estado: {} — tentando JS".format(e))
            try:
                page.evaluate("""
                    (uf) => {
                        var sel = document.querySelector("select[name='Estado']");
                        if (sel) { sel.value = uf; sel.dispatchEvent(new Event('change', {bubbles:true})); }
                    }
                """, estado)
            except Exception as e2:
                self._log("JS estado falhou: {}".format(e2))

        # 2. Aguarda iframe cidades carregar
        time.sleep(3)

        # 3. Clica na cidade correta dentro do iframe
        cidade_clicada = False
        for tentativa in range(3):
            for f in self._todos_frames(page):
                if "cidades" not in (f.name or f.url).lower():
                    continue
                try:
                    links = f.locator("a").all()
                    self._log("Iframe cidades: {} links encontrados.".format(len(links)))
                    for link in links:
                        try:
                            txt = link.inner_text().strip()
                            if not txt:
                                continue
                            # Usa municipio configurado ou o primeiro disponível
                            if (not self.municipio or
                                    self.municipio.lower() in txt.lower()):
                                self._log("Clicando cidade: '{}'".format(txt))
                                link.click(timeout=3000)
                                cidade_clicada = True
                                time.sleep(3)
                                break
                        except Exception:
                            pass
                    if cidade_clicada:
                        break
                except Exception as e:
                    self._log("Erro iframe cidades tentativa {}: {}".format(tentativa+1, e))
            if cidade_clicada:
                break
            self._log("Aguardando cidades carregarem... tentativa {}".format(tentativa+1))
            time.sleep(2)

        if not cidade_clicada:
            # Fallback: submete o form sem cidade (alguns portais aceitam)
            self._log("Nenhuma cidade clicada — tentando submit direto.")
            try:
                page.evaluate("""
                    () => {
                        var f = document.frmEstado || document.forms[0];
                        if (f) f.submit();
                    }
                """)
            except Exception as e:
                self._log("Submit fallback falhou: {}".format(e))

        # 4. Aguarda redirect para o portal real (até 20s)
        self._log("Aguardando redirect para o portal após seleção de município...")
        time.sleep(2)
        for _ in range(20):
            time.sleep(1)
            try:
                url_atual = page.url.lower()
                if self._eh_url_portal(url_atual):
                    self._log("Portal carregado após seleção de município: {}".format(url_atual))
                    self._shot(page, "portal_apos_municipio")
                    return page
                # Verifica outras abas
                for p in page.context.pages:
                    if self._eh_url_portal(p.url.lower()):
                        self._log("Portal em nova aba: {}".format(p.url))
                        p.bring_to_front()
                        self._shot(p, "portal_apos_municipio")
                        return p
            except Exception:
                pass

        self._log("AVISO: redirect não detectado após seleção de município.")
        self._shot(page, "pos_selecao_municipio")
        return page

    def _esta_no_portal(self, page):
        url = self._url_atual(page)
        return "interna" in url or "default.cfm" in url

    def _esta_no_login(self, page):
        url = self._url_atual(page)
        return "portal.gissonline" in url or "login" in url

    # ------------------------------------------------------------------ #
    # ETAPA 1A — Teclado QWERTY virtual                                   #
    # ------------------------------------------------------------------ #

    def _processar_teclado_senha(self, page):
        """
        Digita a senha no teclado QWERTY virtual do GissOnline.

        BUG ANTERIOR: o JS injetava a senha em TxtIdent (campo de USUARIO),
        sobrescrevendo o CMC e fazendo login com credenciais erradas.

        CORRECAO:
          1. Abre o QWERTY clicando na imagem 'ic_use_teclado' ou botão de senha
          2. Aguarda as teclas ficarem visiveis (pos != 0,0)
          3. Clica cada caractere (letra OU digito) nas imagens tec_X.gif
          4. Clica Aceitar para fechar o QWERTY
          Fallback: injeta no campo de preview excluindo explicitamente TxtIdent
        """
        self._log("Digitando senha ({} chars) via QWERTY...".format(len(self.senha)))

        # --- ETAPA 1: Abre o QWERTY clicando na area de senha ---
        qwerty_aberto = False
        for sel in [
            "img[src*='ic_use_teclado']",
            "img[src*='teclado']",
            "input[name*='senha' i]",
            "input[type='password']",
            "a:has-text('senha')",
            "td:has-text('SENHA')",
        ]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0 and loc.is_visible(timeout=1000):
                    loc.click()
                    time.sleep(0.8)
                    qwerty_aberto = True
                    self._log("QWERTY aberto via '{}'.".format(sel))
                    break
            except Exception:
                pass

        # --- ETAPA 2: Constroi mapa de todas as teclas visiveis (letras + digitos) ---
        def _ler_mapa_qwerty():
            mapa = {}
            try:
                for img in page.locator("img").all():
                    try:
                        src = img.get_attribute("src") or ""
                        # Captura letras (tec_A.gif) E digitos (tec_3.gif)
                        m = re.search(r"/tec_([A-Za-z0-9])\.gif", src, re.I)
                        if not m:
                            continue
                        char = m.group(1).upper()
                        box = img.bounding_box()
                        if box and not (box["x"] == 0 and box["y"] == 0):
                            mapa[char] = box
                    except Exception:
                        pass
            except Exception:
                pass
            return mapa

        mapa = _ler_mapa_qwerty()

        # Se QWERTY nao abriu (sem teclas), tenta aguardar
        if not mapa and qwerty_aberto:
            time.sleep(1.5)
            mapa = _ler_mapa_qwerty()

        self._log("QWERTY mapa: {} teclas — {}".format(
            len(mapa), sorted(mapa.keys())))

        # --- ETAPA 3: Clica cada caractere ---
        if mapa:
            for char in self.senha:
                c_up = char.upper()
                clicado = False

                if c_up in mapa:
                    box = mapa[c_up]
                    try:
                        page.mouse.click(
                            box["x"] + box["width"] / 2,
                            box["y"] + box["height"] / 2)
                        clicado = True
                        time.sleep(0.15)
                    except Exception as e:
                        self._log("  Char '{}' mouse.click falhou: {}".format(char, e))

                if not clicado:
                    self._log("  Char '{}' nao encontrado no mapa QWERTY.".format(char))

            # Clica Aceitar para fechar o QWERTY
            for sel_aceitar in [
                "img[src*='bt_aceitar']",
                "input[value*='Aceitar' i]",
                "button:has-text('Aceitar')",
                "a:has-text('Aceitar')",
                "td:has-text('Aceitar')",
            ]:
                try:
                    loc = page.locator(sel_aceitar).first
                    if loc.count() > 0:
                        loc.click(timeout=2000)
                        self._log("Aceitar clicado via '{}'.".format(sel_aceitar))
                        time.sleep(0.5)
                        break
                except Exception:
                    pass

        else:
            # --- FALLBACK: injeta diretamente no campo de preview (excluindo TxtIdent) ---
            self._log("Mapa QWERTY vazio — tentando injecao JS (excluindo TxtIdent)...")
            try:
                resultado = page.evaluate("""
                    (senha) => {
                        var inputs = document.querySelectorAll(
                            'input[type="text"], input[type="password"], input:not([type])'
                        );
                        for (var i = 0; i < inputs.length; i++) {
                            var el = inputs[i];
                            var nome = (el.name || el.id || '').toLowerCase();
                            var r = el.getBoundingClientRect();
                            // Exclui TxtIdent (campo usuario) e campos acima de y=500
                            if (nome === 'txtident' || r.top < 500 || r.width < 30) continue;
                            el.value = senha;
                            el.dispatchEvent(new Event('input',  {bubbles:true}));
                            el.dispatchEvent(new Event('change', {bubbles:true}));
                            el.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true}));
                            return 'injetado em: ' + (el.id || el.name || 'input#' + i)
                                   + ' pos=(' + Math.round(r.left) + ',' + Math.round(r.top) + ')';
                        }
                        return null;
                    }
                """, self.senha)
                if resultado:
                    self._log("Senha injetada via JS fallback: {}".format(resultado))
                else:
                    self._log("JS fallback: campo de preview nao encontrado.")
            except Exception as e:
                self._log("JS fallback falhou: {}".format(e))


    def _tem_captcha_numerico(self, page):
        for sel in [
            "input[placeholder='CAPTCHA']",
            "input[placeholder*='captcha' i]",
            "input[name*='captcha' i]",
            "input[id*='captcha' i]",
        ]:
            try:
                if page.locator(sel).is_visible():
                    return True
            except Exception:
                pass
        return False

    def _capturar_img_captcha(self, page):
        """
        Captura a imagem REAL do CAPTCHA numerico (ex: '6726', '2020').

        PROBLEMA IDENTIFICADO: o portal tem duas imagens proximas ao campo CAPTCHA:
          1. images/ic_use_teclado.jpg  <- instrucao "USE O TECLADO VIRTUAL..."
          2. [imagem dinamica gerada]   <- CAPTCHA real com os digitos
        A estrategia anterior capturava a imagem de instrucao (errada).

        SOLUCAO: ignora imagens estaticas (.jpg fixo) e procura a imagem
        com src DINAMICO (gerada pelo servidor com os digitos randomicos).
        """
        campo_captcha = page.locator("input[placeholder='CAPTCHA']").first

        # === Estrategia 0: lista TODAS as imagens para diagnostico ===
        try:
            todas = page.evaluate("""
                (() => Array.from(document.querySelectorAll('img')).map(i => ({
                    src: i.src,
                    w: i.naturalWidth,
                    h: i.naturalHeight,
                    x: i.getBoundingClientRect().x,
                    y: i.getBoundingClientRect().y
                })))()
            """)
            self._log("Todas as imagens no DOM:")
            for item in (todas or []):
                self._log("  src={} dim={}x{} pos=({},{})".format(
                    item.get("src","")[:70], item.get("w",0), item.get("h",0),
                    int(item.get("x",0)), int(item.get("y",0))))
        except Exception as e:
            self._log("Listagem de imagens falhou: {}".format(e))

        # === Estrategia 1: imagem dinamica (src NAO e .jpg/.png/.gif estatico) ===
        try:
            campo_box = campo_captcha.bounding_box()
            imgs = page.locator("img").all()
            for img in imgs:
                try:
                    src = img.get_attribute("src") or ""
                    src_lower = src.lower()

                    # Ignora imagens estaticas conhecidas
                    # ATENCAO: nao ignora .gif generico pois a imagem CAPTCHA pode ser gif
                    eh_estatica = any([
                        src_lower.endswith(".svg"),
                        src_lower.endswith(".ico"),
                        src_lower.endswith(".webp"),
                        ".jpg" in src_lower,          # instrucoes (ic_use_teclado.jpg)
                        "/tec_" in src_lower,         # teclas do teclado
                        "giss-branco" in src_lower,   # logo
                        "bt_menu" in src_lower,       # botoes menu
                    ])
                    if eh_estatica:
                        self._log("Ignorando imagem estatica: {}".format(src[:60]))
                        continue

                    # Imagem dinamica encontrada — baixa via URL
                    self._log("Imagem dinamica (possivel CAPTCHA): {}".format(src[:80]))

                    if src.startswith("data:image"):
                        b64 = src.split(",", 1)[1]
                        import base64 as _b64
                        dados = _b64.b64decode(b64)
                        self._log("Img CAPTCHA via data URI ({} bytes).".format(len(dados)))
                        return dados

                    # Constroi URL absoluta se necessario
                    if src.startswith("http"):
                        url_img = src
                    elif src.startswith("/"):
                        from urllib.parse import urlparse
                        parsed = urlparse(page.url)
                        url_img = "{}://{}{}".format(parsed.scheme, parsed.netloc, src)
                    elif src:
                        from urllib.parse import urlparse, urljoin
                        url_img = urljoin(page.url, src)
                    else:
                        continue

                    import requests as _req
                    cookies = {ck["name"]: ck["value"] for ck in page.context.cookies()}
                    resp = _req.get(url_img, cookies=cookies, timeout=15,
                                   headers={"Referer": page.url})
                    if resp.status_code == 200 and len(resp.content) > 200:
                        self._log("Img CAPTCHA baixada (dinamica) via URL ({} bytes): {}".format(
                            len(resp.content), url_img[:60]))
                        return resp.content
                    self._log("Download falhou: status={} size={}".format(
                        resp.status_code, len(resp.content)))
                except Exception as e:
                    self._log("Erro ao processar img: {}".format(e))
        except Exception as e:
            self._log("Estrategia 1 falhou: {}".format(e))

        # === Estrategia 2: clip preciso — so a area dos digitos ===
        # O CAPTCHA fica ~40-55px acima do campo input
        try:
            campo_box = campo_captcha.bounding_box()
            if campo_box:
                clip = {
                    "x": max(0, campo_box["x"] - 5),
                    "y": max(0, campo_box["y"] - 58),
                    "width": min(campo_box["width"] + 10, 200),
                    "height": 52,
                }
                dados = page.screenshot(clip=clip)
                self._log("Img CAPTCHA via clip ({} bytes).".format(len(dados)))
                return dados
        except Exception as e:
            self._log("Estrategia 2 (clip) falhou: {}".format(e))

        self._log("ERRO: nao foi possivel capturar imagem do CAPTCHA.")
        return None

    def _ler_teclado_atual(self, page):
        """
        Le o teclado numerico do CAPTCHA usando imagens tec_N.gif.

        O portal GissOnline renderiza o teclado como imagens GIF:
          <img src=".../tec_5.gif" pos=(501,581)>  -> digito 5
          <img src=".../tec_8.gif" pos=(541,581)>  -> digito 8

        O digito esta no nome do arquivo. A posicao muda a cada carregamento
        (teclado embaralhado). Basta ler as coordenadas atuais da img.
        """
        mapa = {}  # {digito_str: {"x":..,"y":..,"width":..,"height":..}}

        # Busca todas as imagens com src contendo '/tec_N' onde N eh 0-9
        try:
            imgs = page.locator("img").all()
            for img in imgs:
                try:
                    src = img.get_attribute("src") or ""
                    # Extrai digito do nome do arquivo: tec_5.gif -> "5"
                    match = re.search(r"/tec_([0-9])\.gif", src, re.I)
                    if not match:
                        continue
                    digito = match.group(1)
                    box = img.bounding_box()
                    if box and box["x"] > 0 and box["y"] > 0:
                        mapa[digito] = box
                        self._log("  Teclado: digito='{}' src={} pos=({:.0f},{:.0f})".format(
                            digito, src.split("/")[-1], box["x"], box["y"]))
                except Exception:
                    pass
        except Exception as e:
            self._log("Erro ao ler teclado por img: {}".format(e))

        if mapa:
            self._log("Teclado lido via img src: {} digitos encontrados: {}".format(
                len(mapa), " ".join(sorted(mapa.keys()))))
        else:
            self._log("Teclado img nao encontrado. Tentando por texto...")
            # Fallback: busca por texto (outros portais)
            for sel in ["span", "td", "div", "button"]:
                try:
                    candidatos = {}
                    for el in page.locator(sel).all():
                        try:
                            txt = el.inner_text().strip()
                            if re.match(r"^\d$", txt):
                                box = el.bounding_box()
                                if box and box["x"] > 0 and txt not in candidatos:
                                    candidatos[txt] = box
                        except Exception:
                            pass
                    if len(candidatos) >= 8:
                        mapa = candidatos
                        break
                except Exception:
                    pass

        return mapa

    def _clicar_teclado_numerico_captcha(self, page, digitos):
        """
        Clica os digitos no teclado numerico do CAPTCHA usando
        page.mouse.click() com coordenadas reais.

        O teclado e lido IMEDIATAMENTE antes de cada clique para
        evitar problemas de embaralhamento durante o 2captcha.
        """
        self._log("Clicando teclado numerico: '{}'".format(digitos))

        # Le o teclado ATUAL (pos-2captcha, pode ter embaralhado)
        mapa = self._ler_teclado_atual(page)

        if not mapa:
            self._log("Teclado nao localizado. Digitando direto no campo.")
            try:
                page.locator("input[placeholder='CAPTCHA']").first.fill(digitos)
                return True
            except Exception as e:
                self._log("Falha ao digitar direto: {}".format(e))
                return False

        self._log("Mapa atual: {}".format(
            {k: "({:.0f},{:.0f})".format(v["x"], v["y"]) for k, v in mapa.items()}))

        for d in digitos:
            if d not in mapa:
                # Teclado pode ter mudado — rele
                self._log("  Digito '{}' nao no mapa. Relendo teclado...".format(d))
                mapa = self._ler_teclado_atual(page)

            if d in mapa:
                box = mapa[d]
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2
                try:
                    # mouse.click gera eventos reais: mousedown+mousemove+mouseup+click
                    page.mouse.click(cx, cy)
                    self._log("  [{}] clicado em ({:.0f},{:.0f}).".format(d, cx, cy))
                    time.sleep(0.3)
                except Exception as e:
                    self._log("  [{}] mouse.click falhou: {}. Tentando force...".format(d, e))
                    try:
                        page.locator("span, td, div, button").filter(
                            has_text=re.compile(r"^{}$".format(d))
                        ).first.click(force=True, timeout=1000)
                        self._log("  [{}] clicado (force fallback).".format(d))
                        time.sleep(0.3)
                    except Exception as e2:
                        self._log("  [{}] FALHOU: {}".format(d, e2))
            else:
                self._log("  [{}] nao encontrado no teclado.".format(d))

        # Verifica se o campo CAPTCHA foi preenchido
        try:
            val = page.locator("input[placeholder='CAPTCHA']").first.input_value()
            self._log("Campo CAPTCHA apos cliques: '{}'".format(val))
            if not val:
                self._log("Campo vazio — tentando digitar diretamente...")
                page.locator("input[placeholder='CAPTCHA']").first.fill(digitos)
        except Exception:
            pass

        self._shot(page, "captcha_preenchido")
        return True

        self._shot(page, "captcha_preenchido")
        return True

    def _resolver_captcha_numerico(self, page):
        """
        Resolve o CAPTCHA numerico.
        Chamado SOMENTE apos o QWERTY estar fechado.
        """
        self._log("=== Resolvendo CAPTCHA numerico ===")
        self._shot(page, "captcha_tela_completa")

        # Captura a imagem (agora com QWERTY fechado = imagem correta)
        img_bytes = self._capturar_img_captcha(page)
        if not img_bytes:
            raise RuntimeError("Nao foi possivel capturar a imagem do CAPTCHA.")

        # Salva para diagnostico
        nome_img = "{}_{}_{}_{}.png".format(
            self._stamp(), self._safe(self.cliente_nome),
            self._safe(self.competencia), "captcha_imagem")
        (self.download_dir / nome_img).write_bytes(img_bytes)
        self.evidencias.append(nome_img)
        self._log("Imagem CAPTCHA salva: {} ({} bytes)".format(nome_img, len(img_bytes)))

        # Envia ao CapSolver
        digitos = ""
        for tentativa in range(1, 4):
            try:
                self._log("2captcha tentativa {}/3...".format(tentativa))
                digitos = self.captcha.resolver_imagem(img_bytes)
                if digitos:
                    self._log("CapSolver resolveu: '{}'".format(digitos))
                    break
                self._log("CapSolver retornou string vazia.")
            except Exception as e:
                self._log("CapSolver t{} erro: {}".format(tentativa, e))
                if tentativa < 3:
                    self._log("Recapturando imagem para nova tentativa...")
                    time.sleep(1)
                    nova = self._capturar_img_captcha(page)
                    if nova and len(nova) != len(img_bytes):
                        img_bytes = nova

        if not digitos:
            raise RuntimeError(
                "CapSolver nao resolveu o CAPTCHA apos 3 tentativas. "
                "Verifique o arquivo captcha_imagem.png — deve mostrar apenas os 4 digitos."
            )

        self._clicar_teclado_numerico_captcha(page, digitos)
        return True

    # ------------------------------------------------------------------ #
    # ETAPA 1 — Login completo                                             #
    # ------------------------------------------------------------------ #

    def _garantir_campos_preenchidos(self, page):
        """
        Verifica se usuario e senha ainda estao preenchidos antes de clicar
        Acessar. O portal pode limpar os campos durante a resolucao do CAPTCHA.
        - Usuario vazio: repreenche imediatamente.
        - Senha vazia: reabre o QWERTY e redigita.
        """
        self._log("Verificando campos login/senha antes de Acessar...")

        # Verifica e repreenche usuario
        usuario_ok = False
        for sel in [
            "input[placeholder='IDENTIFICACAO' i]",
            "input[placeholder='IDENTIFICAÇÃO' i]",
            "input[type='text']",
        ]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    val = loc.input_value()
                    if val and val.strip():
                        self._log("Usuario OK: '{}'.".format(val.strip()))
                        usuario_ok = True
                    else:
                        self._log("Usuario VAZIO — repreenchendo...")
                        loc.click()
                        loc.fill(self.usuario)
                        self._log("Usuario repreenchido: '{}'.".format(self.usuario))
                        usuario_ok = True
                    break
            except Exception:
                pass
        if not usuario_ok:
            self._log("AVISO: nao verificou usuario.")

        # Verifica e repreenche senha
        try:
            campo_senha = page.locator("input[type='password']").first
            if campo_senha.count() > 0:
                val = campo_senha.input_value()
                if val and val.strip():
                    self._log("Senha OK.")
                else:
                    self._log("Senha VAZIA — redigitando via QWERTY...")
                    self._processar_teclado_senha(page)
                    self._log("Senha redigitada.")
        except Exception as e:
            self._log("AVISO: nao verificou senha: {}".format(e))

        self._shot(page, "campos_verificados_pre_acessar")

    def _clicar_acessar(self, page):
        """Clica Acessar sem capturar nova aba (usado em retentativas internas)."""
        for sel in [
            "button:has-text('Acessar')",
            "input[value='Acessar']",
            "a:has-text('Acessar')",
            "input[type='submit']",
        ]:
            try:
                page.locator(sel).first.click(timeout=4000)
                self._log("Acessar clicado via '{}'.".format(sel))
                return True
            except Exception:
                pass
        try:
            page.locator("input[placeholder='CAPTCHA']").first.press("Enter")
            self._log("Acessar via Enter.")
            return True
        except Exception:
            pass
        return False

    def _clicar_acessar_e_capturar(self, page):
        """
        Clica em Acessar e captura a nova aba que o portal abre via window.open().
        O GissOnline abre o portal em nova aba a partir de afterlogin.cfm.
        Usa context.expect_page() para capturar a nova pagina no momento exato.
        """
        self._portal_page = None

        # Estrategia 1: captura nova aba via expect_page (mais confiavel)
        try:
            with page.context.expect_page(timeout=15000) as nova_pagina_info:
                self._clicar_acessar(page)
            nova = nova_pagina_info.value
            nova.wait_for_load_state("domcontentloaded", timeout=30000)
            self._portal_page = nova
            self._log("Nova aba capturada via expect_page: {}".format(nova.url))
            return True
        except Exception as e:
            self._log("expect_page nao capturou nova aba ({}). Verificando abas existentes...".format(e))

        # Estrategia 2: verifica abas que ja existem no contexto
        time.sleep(3)
        try:
            for p in page.context.pages:
                url = p.url.lower()
                if self._eh_url_portal(url):
                    self._portal_page = p
                    self._log("Portal encontrado em aba existente: {}".format(p.url))
                    return True
        except Exception as e:
            self._log("Erro ao verificar abas: {}".format(e))

        self._log("Nenhuma nova aba do portal detectada. Portal pode estar na aba atual.")
        return False

    def _fazer_login(self, page):
        self._log(">>> LOGIN: {}".format(self.base_url))
        # Captura URL do window.open (inclui TXTVALIDA) sem bloquear o popup
        try:
            page.context.add_init_script("""
                window._giss_open_url = null;
                var _orig = window.open;
                window.open = function(url, t, f) {
                    if (url) window._giss_open_url = url;
                    try { return _orig.call(window, url, t, f); } catch(e) { return null; }
                };
            """)
            self._log("Captura de window.open ativa.")
        except Exception as e:
            self._log("Captura window.open: {}".format(e))
        page.goto(self.base_url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)
        self._shot(page, "00_login_inicial")

        # Preenche CMC/usuario
        for sel in [
            "input[placeholder='IDENTIFICAÇÃO' i]",
            "input[placeholder='IDENTIFICACAO' i]",
            "input[type='text']",
            "input[name*='user' i]",
            "input[id*='user' i]",
        ]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    loc.click()
                    loc.fill(self.usuario)
                    self._log("Usuario preenchido via '{}'.".format(sel))
                    break
            except Exception:
                pass

        time.sleep(0.5)

        # QWERTY — digita senha e aguarda teclado fechar
        self._processar_teclado_senha(page)

        # Neste ponto o QWERTY esta fechado (garantido pelo wait acima)
        time.sleep(0.5)

        # CAPTCHA numerico
        if self._tem_captcha_numerico(page):
            self._resolver_captcha_numerico(page)
            time.sleep(0.3)
        else:
            self._log("CAPTCHA nao detectado.")

        # Revalida campos antes de Acessar
        self._garantir_campos_preenchidos(page)

        # Clica Acessar capturando nova aba se abrir via window.open()
        self._portal_page = None  # sera preenchido pelo _clicar_acessar_e_capturar
        self._clicar_acessar_e_capturar(page)
        self._shot(page, "04_apos_acessar")
        time.sleep(3)

    # ------------------------------------------------------------------ #
    # Aguarda portal                                                       #
    # ------------------------------------------------------------------ #

    def _aguardar_portal(self, page):
        """
        Aguarda o portal wwwx.gissonline.com.br.
        Estratégias em ordem:
        1. Aba nova capturada via expect_page/listener
        2. Verifica context.pages a cada 1s por 30s
        3. Lê window._giss_open_url (capturado pelo init_script) e navega
        4. Lê o HTML do afterlogin.cfm e extrai a URL do window.open()
        """
        # Caso 1: aba já capturada
        if getattr(self, "_portal_page", None) is not None:
            p = self._portal_page
            self._log("Usando aba capturada: {}".format(p.url))
            try:
                p.wait_for_load_state("domcontentloaded", timeout=15000)
                p.bring_to_front()
                time.sleep(2)

                # Tela intermediária de seleção de município?
                if self._eh_tela_selecao_municipio(p.url):
                    p = self._tratar_selecao_municipio(p)

                if self._eh_url_portal(p.url):
                    self._shot(p, "05_portal_ok")
                    self._log("Portal carregado!")
                    return p
            except Exception as e:
                self._log("Erro ao processar aba capturada: {}".format(e))

        # Aceita qualquer alert que apareça durante a espera
        try:
            page.on("dialog", lambda d: d.accept())
        except Exception:
            pass
        # Aceita qualquer alert que apareça durante a espera
        try:
            page.on('dialog', lambda d: d.accept())
        except Exception:
            pass
        self._log("Aguardando popup do portal (30s)...")
        inicio = time.time()

        while time.time() - inicio < 30:
            time.sleep(1)

            # Verifica todas as abas
            try:
                for p in page.context.pages:
                    url_p = p.url.lower()
                    if self._eh_url_portal(url_p):
                        self._log("Portal em aba: {}".format(url_p[:70]))
                        p.bring_to_front()
                        time.sleep(2)
                        self._shot(p, "05_portal_ok")
                        self._log("Portal carregado!")
                        return p
            except Exception:
                pass

            # Verifica aba atual
            url = self._url_atual(page)
            if self._eh_url_portal(url):
                time.sleep(2)
                self._shot(page, "05_portal_ok")
                return page

            self._log("URL: {} | Abas: {}".format(url[:60], len(page.context.pages)))

        # Estratégia 3: usa URL capturada pelo init_script
        self._log("Popup nao apareceu. Verificando window._giss_open_url...")
        for tentativa in range(5):
            try:
                url_cap = page.evaluate("() => window._giss_open_url || null")
                self._log("window._giss_open_url = {}".format(url_cap))
                if url_cap:
                    self._log("Navegando para URL capturada (com TXTVALIDA)...")
                    page.goto(url_cap, wait_until="domcontentloaded", timeout=20000)
                    time.sleep(3)
                    url_pos = self._url_atual(page)
                    self._log("Pos-navegacao: {}".format(url_pos[:70]))
                    if self._eh_url_portal(url_pos):
                        self._shot(page, "05_portal_ok")
                        self._log("Portal via URL capturada!")
                        return page
                    break
            except Exception as e:
                self._log("Erro tentativa {}: {}".format(tentativa+1, e))
                time.sleep(2)

        # Estratégia 4: extrai URL do HTML do afterlogin.cfm
        self._log("Extraindo URL do HTML do afterlogin.cfm...")
        try:
            html = page.content()
            self._log("HTML afterlogin: {} bytes".format(len(html)))
            # Salva HTML para diagnóstico
            self._save_txt("afterlogin_html", html[:50000])
            # Busca window.open no HTML
            import re as _re
            url_encontrada = None
            for pat in [
                r'window[.]open\s*[(]["\']([^"\']+)["\']',
                r"https?://[\w.]*gissonline[.][\w./=?&-]+",
            ]:
                m = _re.search(pat, html, _re.I)
                if m:
                    url_encontrada = m.group(1) if m.lastindex else m.group(0)
                    break
            if url_encontrada:
                if True:
                    url_encontrada = m.group(1)
                    self._log("URL no HTML: {}".format(url_encontrada[:100]))
                    if url_encontrada and ("gissonline.com.br" in url_encontrada or url_encontrada.startswith("/")):
                        if url_encontrada.startswith("/"):
                            url_encontrada = "https://www.gissonline.com.br" + url_encontrada
                        page.goto(url_encontrada, wait_until="domcontentloaded", timeout=20000)
                        time.sleep(3)
                        url_pos = self._url_atual(page)
                        if self._eh_url_portal(url_pos):
                            self._shot(page, "05_portal_ok")
                            self._log("Portal via HTML!")
                            return page
        except Exception as e:
            self._log("Extracao HTML falhou: {}".format(e))

        # CAPTCHA errado
        if self._esta_no_login(page) and self._tem_captcha_numerico(page):
            self._log("CAPTCHA errado. Retentando...")
            try:
                self._garantir_campos_preenchidos(page)
                self._resolver_captcha_numerico(page)
                self._garantir_campos_preenchidos(page)
                self._clicar_acessar_e_capturar(page)
            except Exception as e:
                self._log("Erro retentativa: {}".format(e))

        try:
            self._shot(page, "erro_timeout_portal")
        except Exception:
            pass
        raise RuntimeError(
            "Portal nao encontrado. HTML do afterlogin.cfm salvo em evidencias "
            "— envie o arquivo afterlogin_html.txt para diagnostico."
        )


    # ------------------------------------------------------------------ #
    # Travessia recursiva de frames (child_frames)                        #
    # ------------------------------------------------------------------ #

    def _iter_frames(self, frame):
        """Gerador recursivo: percorre frame + todos os child_frames."""
        yield frame
        for filho in frame.child_frames:
            yield from self._iter_frames(filho)

    def _todos_frames(self, page):
        """Lista completa de frames via travessia recursiva de child_frames."""
        return list(self._iter_frames(page.main_frame))

    # ------------------------------------------------------------------ #
    # Diagnostico: salva HTML + resumo JSON de cada frame                 #
    # ------------------------------------------------------------------ #

    def _salvar_evidencias_frames(self, page, sufixo="frames"):
        """
        Salva HTML e resumo textual de todos os frames como evidencia.
        Essencial para diagnosticar portais com framesets aninhados.
        """
        import json as _json
        pasta = self.download_dir
        evidencias = []
        for idx, frame in enumerate(self._todos_frames(page)):
            item = {"idx": idx, "name": frame.name, "url": frame.url}
            try:
                item["texto"] = frame.evaluate(
                    "() => document.body ? document.body.innerText.slice(0, 2000) : ''"
                )
                item["campos"] = frame.evaluate("""
                    () => Array.from(document.querySelectorAll(
                        'input:not([type=hidden]), select, textarea, button, a'
                    )).slice(0, 30).map(el => ({
                        tag:  el.tagName,
                        type: el.getAttribute('type') || '',
                        id:   el.id,
                        name: el.getAttribute('name') || '',
                        text: (el.innerText || el.value || el.getAttribute('title') || '').trim().slice(0,60),
                        href: el.getAttribute('href') || ''
                    }))
                """)
                html = frame.content()
                nome_html = "{}_{}_{}_frame{}.html".format(
                    self._stamp(), self._safe(self.cliente_nome), sufixo, idx)
                (pasta / nome_html).write_text(html, encoding="utf-8", errors="replace")
                item["html_file"] = nome_html
                self.evidencias.append(nome_html)
            except Exception as e:
                item["erro"] = str(e)
            evidencias.append(item)

        nome_json = "{}_{}_{}_frames.json".format(
            self._stamp(), self._safe(self.cliente_nome), sufixo)
        (pasta / nome_json).write_text(
            _json.dumps(evidencias, ensure_ascii=False, indent=2), encoding="utf-8")
        self.evidencias.append(nome_json)
        self._log("Evidencias frames salvas: {} frames, JSON={}".format(
            len(evidencias), nome_json))
        return evidencias

    def _dump_portal(self, page):
        """Loga estrutura de frames para diagnostico rapido no console."""
        self._log("=== DUMP PORTAL ({} frames) ===".format(len(self._todos_frames(page))))
        for idx, f in enumerate(self._todos_frames(page)):
            try:
                resumo = f.evaluate("""
                    () => {
                        var txt = document.body ? document.body.innerText : '';
                        var links = Array.from(document.querySelectorAll(
                            'a, td[onclick], input[type="button"], input[type="submit"], button'
                        )).map(el => (el.innerText || el.value || '').trim())
                          .filter(t => t.length > 0 && t.length < 60).slice(0, 15);
                        var inputs = Array.from(document.querySelectorAll(
                            'input:not([type=hidden]), select'
                        )).map(el => (el.name || el.id || '?') + '[' + (el.type||'text') + ']')
                          .slice(0, 8);
                        return {txt: txt.slice(0,300), links: links, inputs: inputs};
                    }
                """)
                self._log("  [{}] url={} | links={} | inputs={}".format(
                    idx, f.url[:60], resumo["links"], resumo["inputs"]))
                if resumo["txt"].strip():
                    self._log("      texto: {}".format(resumo["txt"][:200].replace("\n", " ")))
            except Exception as e:
                self._log("  [{}] url={} erro={}".format(idx, f.url[:40], e))
        self._log("=== FIM DUMP ===")

    # ------------------------------------------------------------------ #
    # Clique via JavaScript em qualquer frame                             #
    # ------------------------------------------------------------------ #

    def _js_clicar_texto(self, page, texto):
        """Clica via JS no primeiro elemento que contenha o texto em qualquer frame."""
        padrao_lower = re.sub(r"[^a-z0-9 ]", "", texto.lower().strip())
        script = """
            (padrao) => {
                var sels = ['a', 'td', 'span', 'li', 'div',
                            'input[type="button"]', 'input[type="submit"]', 'button'];
                for (var s of sels) {
                    var els = document.querySelectorAll(s);
                    for (var el of els) {
                        var t = (el.innerText || el.value || '').toLowerCase()
                                .replace(/[^a-z0-9 ]/g, '').trim();
                        if (t.indexOf(padrao) !== -1 && t.length < 120) {
                            el.click();
                            return el.tagName + ':' + t.slice(0, 50);
                        }
                    }
                }
                return null;
            }
        """
        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script, padrao_lower)
                if res:
                    self._log("JS click (frame[{}]): '{}'".format(f.url[:50], res))
                    return True
            except Exception:
                pass
        return False

    # ------------------------------------------------------------------ #
    # Fallback OCR: screenshot + pytesseract                              #
    # ------------------------------------------------------------------ #

    def _ocr_clicar_texto(self, page, texto):
        """
        Fallback: tira screenshot, roda OCR, clica nas coordenadas do texto.
        Ativado quando o texto nao aparece no DOM de nenhum frame (Java/canvas).
        """
        try:
            import pytesseract
            from PIL import Image
            import io as _io
        except ImportError:
            self._log("OCR indisponivel (pip install pytesseract pillow). Instale tesseract-ocr tbm.")
            return False

        try:
            png = page.screenshot()
            img = Image.open(_io.BytesIO(png))
            dados = pytesseract.image_to_data(img, lang="por",
                                              output_type=pytesseract.Output.DICT)
            padrao = texto.lower()
            for i, tok in enumerate(dados["text"]):
                if padrao in (tok or "").lower():
                    x = dados["left"][i] + dados["width"][i] // 2
                    y = dados["top"][i] + dados["height"][i] // 2
                    self._log("OCR encontrou '{}' em ({},{}) — clicando.".format(tok, x, y))
                    page.mouse.click(x, y)
                    return True
            self._log("OCR: texto '{}' nao encontrado na screenshot.".format(texto))
        except Exception as e:
            self._log("OCR erro: {}".format(e))
        return False

    # ------------------------------------------------------------------ #
    # Preenche campos mes/ano em qualquer frame                           #
    # ------------------------------------------------------------------ #

    def _preencher_competencia_portal(self, page):
        """Preenche Mes e Ano via JS recursivo em todos os frames."""
        script = """
            ([mes, ano]) => {
                var resultado = [];
                // Campos de mes
                var selsMes = ['input[name*="mes" i]','input[id*="mes" i]','input[size="2"]'];
                for (var s of selsMes) {
                    var el = document.querySelector(s);
                    if (el && el.type !== 'hidden') {
                        el.value = mes;
                        el.dispatchEvent(new Event('input',  {bubbles:true}));
                        el.dispatchEvent(new Event('change', {bubbles:true}));
                        resultado.push('mes:' + (el.name || el.id || s));
                        break;
                    }
                }
                // Campos de ano
                var selsAno = ['input[name*="ano" i]','input[id*="ano" i]','input[size="4"]'];
                for (var s of selsAno) {
                    var el = document.querySelector(s);
                    if (el && el.type !== 'hidden') {
                        el.value = ano;
                        el.dispatchEvent(new Event('input',  {bubbles:true}));
                        el.dispatchEvent(new Event('change', {bubbles:true}));
                        resultado.push('ano:' + (el.name || el.id || s));
                        break;
                    }
                }
                return resultado;
            }
        """
        preencheu_mes = False
        preencheu_ano = False

        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script, [self.comp_mes, self.comp_ano])
                for r in (res or []):
                    if r.startswith("mes:"):
                        self._log("{} (frame: {})".format(r, f.url[:50]))
                        preencheu_mes = True
                    elif r.startswith("ano:"):
                        self._log("{} (frame: {})".format(r, f.url[:50]))
                        preencheu_ano = True
                if preencheu_mes and preencheu_ano:
                    break
            except Exception:
                pass

        # Fallback: Playwright locator em cada frame
        if not preencheu_mes or not preencheu_ano:
            for f in self._todos_frames(page):
                for sel, val, flag in [
                    ("input[name*='mes' i], input[id*='mes' i], input[size='2']",
                     self.comp_mes, "mes"),
                    ("input[name*='ano' i], input[id*='ano' i], input[size='4']",
                     self.comp_ano, "ano"),
                ]:
                    if (flag == "mes" and preencheu_mes) or (flag == "ano" and preencheu_ano):
                        continue
                    try:
                        loc = f.locator(sel).first
                        if loc.count() > 0:
                            loc.triple_click()
                            loc.fill(val)
                            self._log("{} preenchido via locator (frame: {})".format(
                                flag, f.url[:50]))
                            if flag == "mes":
                                preencheu_mes = True
                            else:
                                preencheu_ano = True
                    except Exception:
                        pass

        if not preencheu_mes or not preencheu_ano:
            self._log("AVISO: campos mes/ano nao preenchidos — competencia: {}".format(
                self.competencia))

    # ------------------------------------------------------------------ #
    # Clica link em qualquer frame (JS -> locator -> OCR)                 #
    # ------------------------------------------------------------------ #

    def _clicar_link(self, page, padrao):
        """
        Clica em elemento que corresponda ao padrao em qualquer frame.
        Ordem: 1) JS recursivo  2) Playwright locator  3) OCR fallback
        """
        texto_limpo = re.sub(r"[\\()|^$.*+?{}[\]]", "", padrao).strip()

        # 1. JavaScript em cada frame (child_frames recursivo)
        if self._js_clicar_texto(page, texto_limpo):
            return True

        # 2. Playwright locator em cada frame
        regexp = re.compile(padrao, re.I)
        for frame in self._todos_frames(page):
            for metodo in [
                lambda f=frame: f.locator("a").filter(has_text=regexp).first.click(timeout=1500),
                lambda f=frame: f.locator("td,li").filter(has_text=regexp).first.click(timeout=1500),
                lambda f=frame: f.locator("span,div,button").filter(has_text=regexp).first.click(timeout=1500),
            ]:
                try:
                    metodo()
                    self._log("Link clicado via locator (frame {}): '{}'".format(
                        frame.url[:50], padrao))
                    return True
                except Exception:
                    pass

        # 3. OCR fallback (para componentes Java/canvas fora do DOM)
        self._log("DOM nao encontrou '{}' — tentando OCR...".format(padrao))
        if self._ocr_clicar_texto(page, texto_limpo):
            return True

        self._log("Link NAO encontrado em nenhum frame: '{}'".format(padrao))
        return False

    def _tem_dados_para_encerrar(self, page):
        """
        Verifica se a tela pos-clique em 'Encerrar Escrituracao' exibe
        dados (faturamento, impostos) para confirmar.
        Retorna True se ha dados, False se a tela esta vazia/sem movimento.
        """
        time.sleep(2)
        self._shot(page, "tela_pos_encerrar_escrituracao")

        # Indicadores de que ha dados para encerrar
        indicadores_com_dados = [
            r"TOTAL FATURADO",
            r"TOTAL IMPOSTO",
            r"CONFIRMACAO DO ENCERRAMENTO",
            r"CONFIRMA.AO DO ENCERRAMENTO",
            r"CLIQUE AQUI",
            r"SE DESEJA ENCERRAR",
        ]
        contextos = [page] + [f for f in page.frames if f != page.main_frame]
        for padrao in indicadores_com_dados:
            for ctx in contextos:
                try:
                    if ctx.get_by_text(re.compile(padrao, re.I)).count() > 0:
                        self._log("Dados detectados: '{}' (frame: {})".format(
                            padrao, getattr(ctx, "name", "main") or "main"))
                        return True
                except Exception:
                    pass

        self._log("Sem dados para encerrar (sem movimento).")
        return False

    def _confirmar_encerramento(self, page):
        """
        Tela de confirmacao: clica no primeiro 'CLIQUE AQUI' que NAO seja cancelar.
        Estrutura esperada:
          'SE DESEJA ENCERRAR A COMPETENCIA CLIQUE AQUI'   <- clicar este
          'SE NAO DESEJA EFETUAR O ENCERRAMENTO CLIQUE AQUI'
        """
        self._shot(page, "confirmacao_encerramento")
        time.sleep(1)

        # Percorre pagina + frames buscando o link de confirmacao
        contextos = [page] + [f for f in page.frames if f != page.main_frame]
        for ctx in contextos:
            try:
                links = ctx.get_by_role("link").all()
                for link in links:
                    try:
                        txt = link.inner_text().strip().upper()
                        nao_e_cancelar = (
                            "NAO" not in txt and
                            "NÃO" not in txt and
                            "CANCEL" not in txt and
                            "NAO DESEJA" not in txt
                        )
                        if "CLIQUE" in txt and nao_e_cancelar:
                            link.click(timeout=5000)
                            self._log("Encerramento confirmado: '{}' (frame: {})".format(
                                txt[:80], getattr(ctx, "name", "main") or "main"))
                            time.sleep(3)
                            self._shot(page, "encerramento_confirmado")
                            return True
                    except Exception:
                        pass
            except Exception:
                pass

        # Fallback: _clicar_link (ja busca em frames)
        if self._clicar_link(page, r"SE DESEJA ENCERRAR"):
            time.sleep(3)
            self._shot(page, "encerramento_confirmado")
            return True

        self._log("AVISO: link de confirmacao nao encontrado.")
        return False

    def _encerrar_prestador(self, page):
        """
        FLUXO PRESTADOR:
        - Portal ja abre na aba PRESTADOR por padrao
        - Tenta clicar na aba caso nao esteja ativa
        - Preenche Mes e Ano
        - Clica Encerrar Escrituracao
        - Confirma clicando em CLIQUE AQUI
        """
        self._log("=== PRESTADOR: iniciando encerramento ===")
        self._shot(page, "prestador_inicio")

        # Aguarda frames carregarem completamente
        time.sleep(4)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        time.sleep(2)

        # Salva HTML de cada frame + dump no log
        self._salvar_evidencias_frames(page, "prestador_entrada")
        self._dump_portal(page)

        # Tenta clicar na aba PRESTADOR (pode ja estar ativa)
        clicou_aba = self._clicar_link(page, r"PRESTADOR")
        if clicou_aba:
            time.sleep(2)
        else:
            self._log("Aba PRESTADOR nao clicada — pode ja estar ativa.")
        self._shot(page, "aba_prestador")

        # Preenche competencia (Mes e Ano)
        self._preencher_competencia_portal(page)
        time.sleep(1)
        self._shot(page, "prestador_competencia_preenchida")

        # Clica Encerrar Escrituracao
        encerrou = False
        for texto in [r"Encerrar Escritura", r"Encerrar Escrituração", r"Encerrar Escrit"]:
            if self._clicar_link(page, texto):
                encerrou = True
                self._log("Clicado: Encerrar Escrituracao (Prestador)")
                break

        if not encerrou:
            raise RuntimeError(
                "Link 'Encerrar Escrituracao' nao encontrado para PRESTADOR. "
                "Verifique os screenshots."
            )

        time.sleep(2)

        # Confirma encerramento
        confirmado = self._confirmar_encerramento(page)
        if not confirmado:
            self._log("AVISO: confirmacao do Prestador nao encontrada.")

        self._save_txt(
            "prestador_resultado",
            "\n".join(self.logs + [
                "",
                "Modulo     : PRESTADOR",
                "Competencia: {}".format(self.competencia),
                "Confirmado : {}".format("SIM" if confirmado else "VERIFICAR"),
            ])
        )
        self._log("=== PRESTADOR: concluido ===")
        return True

    def _encerrar_tomador(self, page):
        """
        FLUXO TOMADOR:
        1. Clica aba TOMADOR
        2. Preenche Mes e Ano
        3. Clica Encerrar Escrituracao
        4a. SE aparecerem dados → confirma com CLIQUE AQUI
        4b. SE sem dados → volta em TOMADOR → Encerrar Sem Movimento → confirma
        """
        self._log("=== TOMADOR: iniciando encerramento ===")

        # Clica na aba TOMADOR
        if not self._clicar_link(page, r"TOMADOR"):
            raise RuntimeError("Aba TOMADOR nao encontrada no portal.")
        time.sleep(2)
        self._shot(page, "aba_tomador")

        # Preenche competencia
        self._preencher_competencia_portal(page)
        time.sleep(1)
        self._shot(page, "tomador_competencia_preenchida")

        # Clica Encerrar Escrituracao
        encerrou = False
        for texto in [r"Encerrar Escritura", r"Encerrar Escrituração", r"Encerrar Escrit"]:
            if self._clicar_link(page, texto):
                encerrou = True
                self._log("Clicado: Encerrar Escrituracao (Tomador)")
                break

        if not encerrou:
            raise RuntimeError("Link 'Encerrar Escrituracao' nao encontrado para TOMADOR.")

        # Verifica se ha dados para confirmar
        tem_dados = self._tem_dados_para_encerrar(page)

        if tem_dados:
            # HA DADOS — confirma normalmente
            self._log("TOMADOR: dados encontrados. Confirmando encerramento...")
            confirmado = self._confirmar_encerramento(page)
            resultado = "ENCERRADO" if confirmado else "VERIFICAR"
        else:
            # SEM DADOS — usa Encerrar Sem Movimento
            self._log("TOMADOR: sem movimento. Voltando para Encerrar Sem Movimento...")

            # Volta para aba TOMADOR
            self._clicar_link(page, r"TOMADOR")
            time.sleep(2)
            self._shot(page, "tomador_volta_sem_movimento")

            # Preenche competencia novamente
            self._preencher_competencia_portal(page)
            time.sleep(1)

            # Clica Encerrar Sem Movimento
            if not self._clicar_link(page, r"Encerrar Sem Movimento"):
                raise RuntimeError("Link 'Encerrar Sem Movimento' nao encontrado para TOMADOR.")

            self._log("Clicado: Encerrar Sem Movimento (Tomador)")
            time.sleep(2)
            self._shot(page, "tomador_sem_movimento_clicado")

            # Confirma
            confirmado = self._confirmar_encerramento(page)
            resultado = "SEM_MOVIMENTO" if confirmado else "VERIFICAR"

        self._save_txt(
            "tomador_resultado",
            "\n".join(self.logs + [
                "",
                "Modulo     : TOMADOR",
                "Competencia: {}".format(self.competencia),
                "Resultado  : {}".format(resultado),
            ])
        )
        self._log("=== TOMADOR: concluido ({}) ===".format(resultado))
        return True

    # Mantem compatibilidade com o worker do app.py
    def _executar_encerramento(self, page, modulo):
        if modulo.upper() == "PRESTADOR":
            return self._encerrar_prestador(page)
        elif modulo.upper() == "TOMADOR":
            return self._encerrar_tomador(page)
        else:
            raise RuntimeError("Modulo desconhecido: {}".format(modulo))

    # ------------------------------------------------------------------ #
    # Ponto de entrada                                                     #
    # ------------------------------------------------------------------ #

    def run(self, executar_prestados=True, executar_tomados=True):
        mensagens = []

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-popup-blocking",
                ],
            )
            context = browser.new_context(
                accept_downloads=True,
                ignore_https_errors=True,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            if STEALTH_DISPONIVEL:
                try:
                    stealth_sync(page)
                    self._log("playwright-stealth ativo.")
                except Exception:
                    pass
            else:
                self._log("playwright-stealth nao instalado (opcional).")

            try:
                self._fazer_login(page)
                # _aguardar_portal retorna a pagina onde o portal carregou
                # (pode ser nova aba aberta via window.open)
                portal_page = self._aguardar_portal(page)

                if executar_prestados:
                    self._executar_encerramento(portal_page, "PRESTADOR")
                    mensagens.append("Prestador encerrado")

                if executar_tomados:
                    self._executar_encerramento(portal_page, "TOMADOR")
                    mensagens.append("Tomador encerrado")

            except PlaywrightTimeoutError:
                self._shot(page, "erro_timeout")
                self._save_txt("erro_timeout", "\n".join(self.logs))
                raise RuntimeError("Timeout na navegacao do GissOnline.")

            except Exception as e:
                self._log("ERRO: {}".format(e))
                try:
                    self._shot(page, "erro_geral")
                except Exception:
                    pass
                self._save_txt("erro_geral", "\n".join(self.logs))
                raise RuntimeError(str(e))

            finally:
                try:
                    context.close()
                    browser.close()
                except Exception:
                    pass

        return {
            "status":     "SUCESSO",
            "mensagem":   "; ".join(mensagens) if mensagens else "Sem acoes executadas",
            "evidencias": self.evidencias,
        }
