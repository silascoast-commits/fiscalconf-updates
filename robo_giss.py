# =============================================================================
#  robo_giss.py — GissBot v7
#  GissOnline — Encerramento de Escrituração Automático
#
#  FLUXO REAL (baseado no portal observado):
#    1. Login em portal.gissonline.com.br/login/index.html
#       - Preenche IDENTIFICAÇÃO, SENHA, CAPTCHA (via 2captcha)
#       - Clica Acessar → portal abre em nova aba via window.open
#    2. Portal: wwwx.gissonline.com.br/interna/default.cfm
#    3. PRESTADOR:
#       - Clica aba PRESTADOR → preenche Mês/Ano
#       - SE tem notas → "Encerrar Escrituração" → "CLIQUE AQUI"
#       - SE sem movimento → "Encerrar Sem Movimento"
#    4. TOMADOR: mesmo fluxo do PRESTADOR
# =============================================================================

from pathlib import Path
from datetime import datetime
import re, time, os, base64, requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

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
    """Resolve CAPTCHA de imagem numérica via 2captcha.com"""
# ===========================================================================

    def __init__(self, api_key):
        self.api_key = api_key

    def verificar_saldo(self):
        try:
            resp = requests.get(
                CAPTCHA2_RES_URL,
                params={"key": self.api_key, "action": "getbalance", "json": 1},
                timeout=15,
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
                "Cadastre-se em https://2captcha.com e cole sua chave em CAPTCHA2_API_KEY."
            )

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

        # Upscale se imagem muito pequena
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

        resp = requests.post(
            CAPTCHA2_IN_URL,
            data={
                "key": self.api_key, "method": "base64", "body": b64,
                "json": 1, "numeric": 1, "min_len": 4, "max_len": 6,
            },
            timeout=30,
        )
        data = resp.json()
        print("[2captcha] Submit: {}".format(data))

        if data.get("status") != 1:
            raise RuntimeError("2captcha submit erro: {}".format(data.get("request", data)))

        captcha_id = data["request"]
        print("[2captcha] ID: {}".format(captcha_id))

        time.sleep(10)
        for poll in range(20):
            resp2 = requests.get(
                CAPTCHA2_RES_URL,
                params={"key": self.api_key, "action": "get", "id": captcha_id, "json": 1},
                timeout=15,
            )
            d2 = resp2.json()
            print("[2captcha] Poll {}: {}".format(poll + 1, d2))

            if d2.get("status") == 1:
                texto   = str(d2.get("request", "")).strip()
                digitos = re.sub(r"[^0-9]", "", texto)
                print("[2captcha] Resolvido: '{}' → digitos='{}'".format(texto, digitos))
                return digitos

            req = d2.get("request", "")
            if req == "ERROR_CAPTCHA_UNSOLVABLE":
                raise RuntimeError("2captcha: CAPTCHA insoluvel.")
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
        self.estado       = config.get("estado", "SP")
        self.municipio    = config.get("municipio", "")

        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.evidencias = []
        self.logs       = []
        self._portal_page = None

        partes = self.competencia.split("/")
        self.comp_mes = partes[0].strip().zfill(2) if len(partes) >= 1 else ""
        self.comp_ano = partes[1].strip()           if len(partes) >= 2 else ""

        self.captcha = CaptchaClient(CAPTCHA2_API_KEY)

    # ------------------------------------------------------------------ #
    # Utilitários                                                          #
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

    # ------------------------------------------------------------------ #
    # Frame traversal recursivo (ColdFusion usa framesets)                #
    # ------------------------------------------------------------------ #

    def _iter_frames(self, frame):
        yield frame
        for filho in frame.child_frames:
            yield from self._iter_frames(filho)

    def _todos_frames(self, page):
        return list(self._iter_frames(page.main_frame))

    # ------------------------------------------------------------------ #
    # URL helpers                                                          #
    # ------------------------------------------------------------------ #

    def _eh_url_portal(self, url):
        url = url.lower()
        return (
            "gissonline" in url
            and ("interna" in url or "default.cfm" in url)
            and "login/index"   not in url
            and "afterlogin"    not in url
            and "troca_senha"   not in url
            and "seleciona_est" not in url
        )

    def _eh_tela_municipio(self, url):
        url = url.lower()
        return "troca_senha" in url or "seleciona_estado" in url

    # ------------------------------------------------------------------ #
    # LOGIN                                                                #
    # ------------------------------------------------------------------ #

    def _preencher_campo_direto(self, page, seletores, valor, nome):
        """Preenche campo via fill() ou type(). Retorna True se preencheu."""
        for sel in seletores:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0 and loc.is_visible(timeout=2000):
                    loc.click()
                    time.sleep(0.2)
                    loc.fill(valor)
                    if loc.input_value():
                        self._log("{} preenchido via fill('{}').".format(nome, sel))
                        return True
                    # Alguns campos recusam fill() — tenta type()
                    loc.triple_click()
                    loc.type(valor, delay=50)
                    if loc.input_value():
                        self._log("{} preenchido via type('{}').".format(nome, sel))
                        return True
            except Exception as e:
                self._log("  '{}' → {}".format(sel, e))
        return False

    def _digitar_senha_qwerty(self, page):
        """
        Fallback: usa o teclado QWERTY virtual para digitar a senha.
        Mapeia SOMENTE letras (tec_[A-Z].gif) — os dígitos tec_[0-9].gif
        pertencem ao teclado do CAPTCHA e devem ser ignorados aqui.
        """
        self._log("Abrindo teclado QWERTY virtual...")
        for sel in ["img[src*='ic_use_teclado']", "td:has-text('SENHA')"]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0 and loc.is_visible(timeout=1000):
                    loc.click()
                    time.sleep(1.0)
                    break
            except Exception:
                pass

        mapa = {}
        for img in page.locator("img").all():
            try:
                src = img.get_attribute("src") or ""
                m = re.search(r"/tec_([A-Za-z])\.gif", src, re.I)
                if not m:
                    continue
                box = img.bounding_box()
                if box and box["x"] > 0 and box["y"] > 0:
                    mapa[m.group(1).upper()] = box
            except Exception:
                pass

        self._log("QWERTY letras mapeadas: {} ({})".format(len(mapa), sorted(mapa.keys())))
        if not mapa:
            self._log("AVISO: QWERTY nao abriu — senha pode nao ter sido digitada.")
            return

        for char in self.senha:
            c = char.upper()
            if c in mapa:
                b = mapa[c]
                page.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
                time.sleep(0.15)
            else:
                self._log("  Char '{}' nao no QWERTY.".format(char))

        # Fecha QWERTY
        for sel in ["img[src*='bt_aceitar']", "input[value*='Aceitar' i]",
                    "button:has-text('Aceitar')", "a:has-text('Aceitar')"]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    loc.click(timeout=2000)
                    self._log("QWERTY fechado via '{}'.".format(sel))
                    time.sleep(0.5)
                    break
            except Exception:
                pass

    def _fechar_qwerty_jquery(self, page):
        """
        Fecha o teclado QWERTY jQuery do campo SENHA se estiver aberto.

        PROBLEMA: Após fill() no campo TxtSenha, o jQuery-keyboard abre
        automaticamente e fica posicionado sobre o campo CAPTCHA (top≈505px),
        bloqueando qualquer interação com o CAPTCHA.
        SOLUÇÃO: clicar no botão 'Aceitar' do jQuery-keyboard para fechá-lo.
        """
        seletores = [
            "button.ui-keyboard-accept",
            "button[data-value='Aceitar']",
            "button[name='accept']",
            ".ui-keyboard button:has-text('Aceitar')",
        ]
        for sel in seletores:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0 and loc.is_visible(timeout=1500):
                    loc.click()
                    self._log("jQuery QWERTY fechado via '{}'.".format(sel))
                    time.sleep(0.5)
                    return True
            except Exception:
                pass
        # Tenta pressionar Escape para fechar
        try:
            page.keyboard.press("Escape")
            time.sleep(0.3)
            self._log("jQuery QWERTY fechado via Escape.")
            return True
        except Exception:
            pass
        return False

    def _ler_captcha_do_dom(self, page):
        """
        Lê o CAPTCHA diretamente do iframe frmDiv (nroChg.cfm) — SEM 2captcha.

        O portal GissOnline renderiza cada dígito do CAPTCHA como:
          <img name="numSeq1" src="/images/autentic_9.jpg" value="9">
          <img name="numSeq2" src="/images/autentic_3.jpg" value="3">
          ...
        O atributo 'value' contém o dígito. Lemos e concatenamos em ordem.
        """
        for f in self._todos_frames(page):
            try:
                # Busca imgs com name="numSeqN" (iframe nroChg.cfm)
                resultado = f.evaluate("""() => {
                    var imgs = Array.from(document.querySelectorAll('img[name^="numSeq"]'));
                    if (!imgs.length) return null;
                    imgs.sort((a,b) => (a.name > b.name ? 1 : -1));
                    return imgs.map(i => i.getAttribute('value') || '').join('');
                }""")
                if resultado and re.match(r"^\d{3,6}$", resultado):
                    self._log("CAPTCHA lido do DOM (frame {}): '{}'".format(
                        f.url[:50], resultado))
                    return resultado

                # Fallback: src com 'autentic_N'
                resultado2 = f.evaluate("""() => {
                    var imgs = Array.from(document.querySelectorAll('img[src*="autentic_"]'));
                    if (!imgs.length) return null;
                    return imgs.map(i => i.getAttribute('value') || '').join('');
                }""")
                if resultado2 and re.match(r"^\d{3,6}$", resultado2):
                    self._log("CAPTCHA lido via autentic_ (frame {}): '{}'".format(
                        f.url[:50], resultado2))
                    return resultado2
            except Exception:
                pass
        return None

    def _preencher_captcha_js(self, page, digitos):
        """
        Preenche o campo CAPTCHA via JavaScript, bypassando o onkeypress
        fctValidaTeclado que bloqueia digitação normal no campo TxtValida.
        """
        resultado = page.evaluate("""(v) => {
            var el = document.getElementById('TxtValida')
                  || document.querySelector("input[name='TxtValida']")
                  || document.querySelector("input[placeholder='CAPTCHA']");
            if (!el) return 'campo nao encontrado';
            el.value = v;
            el.dispatchEvent(new Event('input',  {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
            return 'ok:' + el.value;
        }""", digitos)
        self._log("CAPTCHA via JS: {}".format(resultado))

        # Verifica também em frames filhos
        if not (resultado or "").startswith("ok:"):
            for f in self._todos_frames(page):
                try:
                    r2 = f.evaluate("""(v) => {
                        var el = document.getElementById('TxtValida')
                              || document.querySelector("input[name='TxtValida']");
                        if (!el) return null;
                        el.value = v;
                        return 'ok:' + el.value;
                    }""", digitos)
                    if r2 and r2.startswith("ok:"):
                        self._log("CAPTCHA via JS (frame {}): {}".format(f.url[:40], r2))
                        break
                except Exception:
                    pass

        return True

    def _resolver_captcha(self, page):
        """
        Resolve e preenche o CAPTCHA.

        ESTRATÉGIA 1 (preferida): lê os dígitos diretamente do DOM do iframe
          frmDiv (nroChg.cfm) — os atributos value das imgs autentic_N.jpg
          contêm o dígito. Gratuito, instantâneo, 100% preciso.

        ESTRATÉGIA 2 (fallback): captura imagem e envia ao 2captcha.
        """
        self._log("=== Resolvendo CAPTCHA ===")
        self._shot(page, "captcha_antes")

        # Estratégia 1: lê do DOM
        digitos = self._ler_captcha_do_dom(page)

        # Estratégia 2: 2captcha (fallback)
        if not digitos:
            self._log("DOM nao encontrou CAPTCHA — usando 2captcha...")
            img_bytes = self._capturar_img_captcha_2captcha(page)
            if not img_bytes:
                raise RuntimeError("Não foi possível capturar a imagem do CAPTCHA.")
            nome_img = "{}_{}_{}_captcha.png".format(
                self._stamp(), self._safe(self.cliente_nome), self._safe(self.competencia))
            (self.download_dir / nome_img).write_bytes(img_bytes)
            self.evidencias.append(nome_img)
            self._log("Imagem CAPTCHA salva: {} ({} bytes)".format(nome_img, len(img_bytes)))
            for tentativa in range(1, 4):
                try:
                    self._log("2captcha tentativa {}/3...".format(tentativa))
                    digitos = self.captcha.resolver_imagem(img_bytes)
                    if digitos:
                        break
                except Exception as e:
                    self._log("2captcha t{} erro: {}".format(tentativa, e))
                    if tentativa < 3:
                        time.sleep(2)

        if not digitos:
            raise RuntimeError("Não foi possível resolver o CAPTCHA.")

        self._log("CAPTCHA resolvido: '{}'".format(digitos))
        self._preencher_captcha_js(page, digitos)

    def _capturar_img_captcha_2captcha(self, page):
        """Captura imagem do CAPTCHA para envio ao 2captcha (fallback)."""
        IGNORAR = [".jpg", "/tec_", "giss-branco", "bt_menu",
                   "ic_use_teclado", ".svg", ".ico", ".webp"]
        for img in page.locator("img").all():
            try:
                src = img.get_attribute("src") or ""
                if any(x in src.lower() for x in IGNORAR):
                    continue
                if src.startswith("data:image"):
                    return base64.b64decode(src.split(",", 1)[1])
                if not src.startswith("http"):
                    from urllib.parse import urljoin
                    src = urljoin(page.url, src)
                cookies = {c["name"]: c["value"] for c in page.context.cookies()}
                resp = requests.get(src, cookies=cookies, timeout=15,
                                    headers={"Referer": page.url}, verify=False)
                if resp.status_code == 200 and len(resp.content) > 200:
                    return resp.content
            except Exception:
                pass
        # Clip acima do campo CAPTCHA
        try:
            campo = page.locator("input[placeholder='CAPTCHA']").first
            box = campo.bounding_box()
            if box:
                clip = {"x": max(0, box["x"]-5), "y": max(0, box["y"]-58),
                        "width": min(box["width"]+10, 200), "height": 52}
                return page.screenshot(clip=clip)
        except Exception:
            pass
        return None

    def _clicar_acessar(self, page):
        for sel in ["button:has-text('Acessar')", "input[value='Acessar']",
                    "a:has-text('Acessar')", "input[type='submit']"]:
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

    def _fazer_login(self, page):
        self._log(">>> LOGIN: {}".format(self.base_url))

        # Intercepta window.open para capturar URL do portal
        try:
            page.context.add_init_script("""
                window._giss_open_url = null;
                var _orig = window.open;
                window.open = function(url, t, f) {
                    if (url) window._giss_open_url = url;
                    try { return _orig.call(window, url, t, f); } catch(e) { return null; }
                };
            """)
        except Exception:
            pass

        page.goto(self.base_url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(2)
        self._shot(page, "01_login")

        # IDENTIFICAÇÃO
        ok = self._preencher_campo_direto(page, [
            "input[placeholder='IDENTIFICAÇÃO' i]",
            "input[placeholder='IDENTIFICACAO' i]",
            "input[name*='ident' i]",
            "input[type='text']",
        ], self.usuario, "Identificacao")
        if not ok:
            self._log("AVISO: Identificação não preenchida!")

        time.sleep(0.5)

        # SENHA — fill direto primeiro, QWERTY como fallback
        ok = self._preencher_campo_direto(page, [
            "input[placeholder='SENHA' i]",
            "input[name='TxtSenha']",
            "input[name*='senha' i]",
            "input[id*='senha' i]",
            "input[type='password']",
        ], self.senha, "Senha")
        if not ok:
            self._log("Fill direto falhou para senha — tentando QWERTY virtual...")
            self._digitar_senha_qwerty(page)

        time.sleep(0.5)

        # Fecha o jQuery QWERTY que abre automaticamente ao clicar no campo SENHA.
        # Ele cobre fisicamente o campo CAPTCHA (top≈505px) e bloqueia interações.
        self._fechar_qwerty_jquery(page)
        time.sleep(0.5)
        self._shot(page, "02_campos_preenchidos")

        # CAPTCHA — lê do DOM do iframe (gratuito) ou 2captcha como fallback
        self._resolver_captcha(page)
        time.sleep(0.5)
        self._shot(page, "03_captcha_preenchido")

        # Verifica campos antes de clicar Acessar
        self._verificar_campos_login(page)

        # Clica Acessar — captura nova aba se abrir via window.open
        self._portal_page = None
        try:
            with page.context.expect_page(timeout=15000) as nova_info:
                self._clicar_acessar(page)
            nova = nova_info.value
            nova.wait_for_load_state("domcontentloaded", timeout=30000)
            self._portal_page = nova
            self._log("Nova aba capturada: {}".format(nova.url))
        except Exception as e:
            self._log("expect_page: {} — continuando sem nova aba.".format(e))
            self._clicar_acessar(page)

        self._shot(page, "04_apos_acessar")
        time.sleep(3)

    def _verificar_campos_login(self, page):
        """Verifica se identificação e senha estão preenchidas antes de Acessar."""
        self._log("Verificando campos antes de Acessar...")

        # Identificação
        for sel in ["input[placeholder='IDENTIFICAÇÃO' i]",
                    "input[placeholder='IDENTIFICACAO' i]", "input[type='text']"]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    val = loc.input_value()
                    if val and val.strip():
                        self._log("Identificação OK: '{}'.".format(val.strip()))
                    else:
                        self._log("Identificação VAZIA — repreenchendo...")
                        loc.fill(self.usuario)
                    break
            except Exception:
                pass

        # Senha
        for sel in ["input[placeholder='SENHA' i]", "input[name='TxtSenha']",
                    "input[name*='senha' i]", "input[type='password']"]:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    val = loc.input_value()
                    if val and val.strip():
                        self._log("Senha OK.")
                    else:
                        self._log("Senha VAZIA — redigitando...")
                        ok = self._preencher_campo_direto(page, [sel], self.senha, "Senha")
                        if not ok:
                            self._digitar_senha_qwerty(page)
                    break
            except Exception:
                pass

        self._shot(page, "campos_verificados")

    # ------------------------------------------------------------------ #
    # Aguarda portal                                                       #
    # ------------------------------------------------------------------ #

    def _aguardar_portal(self, page):
        """
        Aguarda o portal carregar após o login.
        O GissOnline abre o portal via window.open em nova aba.
        """
        # Caso 1: aba capturada via expect_page
        if self._portal_page is not None:
            p = self._portal_page
            self._log("Usando aba capturada: {}".format(p.url))
            try:
                p.wait_for_load_state("domcontentloaded", timeout=15000)
                p.bring_to_front()
                time.sleep(2)
                if self._eh_tela_municipio(p.url):
                    p = self._tratar_selecao_municipio(p)
                if self._eh_url_portal(p.url):
                    self._shot(p, "05_portal_ok")
                    self._log("Portal OK: {}".format(p.url))
                    return p
            except Exception as e:
                self._log("Erro ao usar aba capturada: {}".format(e))

        # Aceita dialogs automáticos
        try:
            page.on("dialog", lambda d: d.accept())
        except Exception:
            pass

        # Caso 2: varre todas as abas por 30s
        self._log("Aguardando portal em qualquer aba (30s)...")
        inicio = time.time()
        while time.time() - inicio < 30:
            time.sleep(1)
            for p in page.context.pages:
                url = p.url.lower()
                if self._eh_tela_municipio(url):
                    p.bring_to_front()
                    p = self._tratar_selecao_municipio(p)
                if self._eh_url_portal(p.url.lower()):
                    p.bring_to_front()
                    time.sleep(2)
                    self._shot(p, "05_portal_ok")
                    self._log("Portal carregado: {}".format(p.url))
                    return p
            self._log("Aguardando... abas={} url={}".format(
                len(page.context.pages), page.url[:60]))

        # Caso 3: usa URL capturada pelo init_script
        try:
            url_cap = page.evaluate("() => window._giss_open_url || null")
            if url_cap:
                self._log("Navegando para URL capturada: {}".format(url_cap[:80]))
                page.goto(url_cap, wait_until="domcontentloaded", timeout=20000)
                time.sleep(3)
                if self._eh_url_portal(page.url.lower()):
                    self._shot(page, "05_portal_ok")
                    return page
        except Exception as e:
            self._log("URL capturada falhou: {}".format(e))

        self._shot(page, "erro_portal_nao_encontrado")
        raise RuntimeError(
            "Portal não carregou após 30s. "
            "Verifique credenciais e a imagem do CAPTCHA nas evidências."
        )

    def _tratar_selecao_municipio(self, page):
        """
        Seleciona estado e município na tela intermediária que alguns
        municípios exibem após o login.
        """
        self._log("=== Seleção de município ===")
        self._shot(page, "selecao_municipio")
        estado = (self.estado or "SP").upper()

        try:
            page.select_option("select[name='Estado']", value=estado, timeout=5000)
            self._log("Estado '{}' selecionado.".format(estado))
        except Exception:
            try:
                page.evaluate("""(uf) => {
                    var s = document.querySelector("select[name='Estado']");
                    if (s) { s.value=uf; s.dispatchEvent(new Event('change',{bubbles:true})); }
                }""", estado)
            except Exception:
                pass

        time.sleep(3)

        cidade_clicada = False
        for _ in range(3):
            for f in self._todos_frames(page):
                if "cidades" not in (f.name or f.url).lower():
                    continue
                try:
                    for link in f.locator("a").all():
                        txt = link.inner_text().strip()
                        if not txt:
                            continue
                        if not self.municipio or self.municipio.lower() in txt.lower():
                            link.click(timeout=3000)
                            self._log("Cidade clicada: '{}'".format(txt))
                            cidade_clicada = True
                            time.sleep(3)
                            break
                except Exception:
                    pass
                if cidade_clicada:
                    break
            if cidade_clicada:
                break
            time.sleep(2)

        for _ in range(20):
            time.sleep(1)
            for p in page.context.pages:
                if self._eh_url_portal(p.url.lower()):
                    self._log("Portal após município: {}".format(p.url))
                    return p

        self._log("AVISO: redirect após município não detectado.")
        return page

    # ------------------------------------------------------------------ #
    # Ações no portal                                                      #
    # ------------------------------------------------------------------ #

    def _clicar_link(self, page, texto, timeout_ms=5000):
        """
        Localiza elemento pelo texto em qualquer frame e clica via JS nativo.

        Prioridade:
          1. JS: chama .click() nativo do elemento <a>/<button> encontrado pelo texto
             (sem coordenadas de mouse — funciona em qualquer frame/frameset)
          2. Playwright locator → .click() (gerencia coordenadas automaticamente)
          3. JS sintético em containers
        """
        import unicodedata
        def _norm(s):
            s = (s or "").strip().lower()
            s = "".join(c for c in unicodedata.normalize("NFD", s)
                        if unicodedata.category(c) != "Mn")
            return re.sub(r"\s+", " ", s)

        termos = list({_norm(texto), texto.lower().strip()})

        # ── Estratégia 1: JS click() direto no elemento ──────────────────
        # Não usa coordenadas de mouse — funciona mesmo em frames aninhados.
        # Prioriza <a> e <button> (folhas). Ignora containers grandes.
        script_js_click = r"""(termos) => {
            const norm = s => {
                s = (s || '').trim().toLowerCase();
                s = s.normalize('NFD').replace(/[̀-ͯ]/g,'');
                return s.replace(/\s+/g,' ');
            };
            const FOLHAS = 'a,button,input[type="button"],input[type="submit"],input[type="image"]';
            for (const el of document.querySelectorAll(FOLHAS)) {
                const txt = norm([
                    el.innerText, el.textContent, el.value,
                    el.alt, el.title
                ].filter(Boolean).join(' '));
                if (txt.length > 0 && txt.length < 400 &&
                        termos.some(t => txt.includes(t))) {
                    el.scrollIntoView({block:'center'});
                    try { el.focus(); } catch(e) {}
                    el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
                    el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
                    el.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, button:0}));
                    el.dispatchEvent(new MouseEvent('mouseup',   {bubbles:true, button:0}));
                    el.click();
                    return {ok:true, tag:el.tagName, txt:txt.slice(0,80), href:(el.href||''), onclick:(el.getAttribute('onclick')||'').slice(0,80)};
                }
            }
            return {ok:false};
        }"""

        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_js_click, termos)
                if res and res.get("ok"):
                    self._log("Clicado '{}' via JS.click() frame {} tag={} txt={} href={} oc={}".format(
                        texto, f.url[:40], res.get("tag"), res.get("txt","")[:60],
                        res.get("href","")[:60], res.get("onclick","")[:60]))
                    return True
            except Exception as e:
                self._log("  JS click frame {}: {}".format(f.url[:40], e))

        # ── Estratégia 2: Playwright locator .click() (gerencia frame coords) ──
        regexp = re.compile(re.escape(texto), re.I)
        for frame in self._todos_frames(page):
            for sel in ["a", "button", "input[type='button']", "input[type='submit']"]:
                try:
                    loc = frame.locator(sel).filter(has_text=regexp).first
                    if loc.count() > 0 and loc.is_visible(timeout=1500):
                        loc.scroll_into_view_if_needed(timeout=2000)
                        loc.click(timeout=timeout_ms)
                        self._log("Clicado '{}' Playwright locator '{}' frame {}.".format(
                            texto, sel, frame.url[:50]))
                        return True
                except Exception:
                    pass

        # ── Estratégia 3: containers com onclick ──────────────────────────
        script_container = r"""(termos) => {
            const norm = s => {
                s = (s || '').trim().toLowerCase();
                s = s.normalize('NFD').replace(/[̀-ͯ]/g,'');
                return s.replace(/\s+/g,' ');
            };
            const sels = 'td[onclick],span[onclick],div[onclick],li[onclick]';
            for (const el of document.querySelectorAll(sels)) {
                const txt = norm((el.innerText||el.textContent||''));
                if (txt.length > 0 && txt.length < 200 &&
                        termos.some(t => txt.includes(t))) {
                    el.scrollIntoView({block:'center'});
                    el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
                    el.click();
                    return {ok:true, tag:el.tagName, txt:txt.slice(0,80)};
                }
            }
            return {ok:false};
        }"""

        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_container, termos)
                if res and res.get("ok"):
                    self._log("Clicado '{}' container JS frame {}: tag={} txt={}".format(
                        texto, f.url[:40], res.get("tag"), res.get("txt","")[:60]))
                    return True
            except Exception as e:
                self._log("  JS container frame {}: {}".format(f.url[:40], e))

        self._log("Link NAO encontrado: '{}'".format(texto))
        return False

    def _preencher_competencia(self, page):
        """
        Preenche Mês e Ano via Playwright fill() — envia teclas reais para que
        o onclick do portal leia o valor corretamente (el.value = x não é suficiente).

        Campos confirmados: name='mes' (maxlength=2) e name='ano' (maxlength=4)
        em contribuinte2.asp (PRESTADOR) e tomador.asp (TOMADOR).
        """
        PORTAL = "wwwx.gissonline.com.br"

        SELS_MES = [
            "input[name='mes']",
            "input[name='mes_competencia']",
            "input[name='mes_comp']",
            "input[maxlength='2']:not([type='hidden'])",
        ]
        SELS_ANO = [
            "input[name='ano']",
            "input[name='ano_competencia']",
            "input[name='ano_comp']",
            "input[maxlength='4']:not([type='hidden'])",
        ]

        ok_mes = ok_ano = False

        for f in self._todos_frames(page):
            if PORTAL not in f.url:
                continue
            try:
                # Encontra locator de mes
                loc_mes = None
                for sel in SELS_MES:
                    lc = f.locator(sel)
                    if lc.count() > 0:
                        loc_mes = lc.first
                        break

                # Encontra locator de ano
                loc_ano = None
                for sel in SELS_ANO:
                    lc = f.locator(sel)
                    if lc.count() > 0:
                        loc_ano = lc.first
                        break

                if loc_mes and not ok_mes:
                    loc_mes.scroll_into_view_if_needed(timeout=3000)
                    loc_mes.click(click_count=3, timeout=3000)
                    loc_mes.fill(self.comp_mes, timeout=3000)
                    loc_mes.press("Tab")
                    self._log("Mês={} via fill frame {}.".format(
                        self.comp_mes, f.url[:60]))
                    ok_mes = True

                if loc_ano and not ok_ano:
                    loc_ano.scroll_into_view_if_needed(timeout=3000)
                    loc_ano.click(click_count=3, timeout=3000)
                    loc_ano.fill(self.comp_ano, timeout=3000)
                    loc_ano.press("Tab")
                    self._log("Ano={} via fill frame {}.".format(
                        self.comp_ano, f.url[:60]))
                    ok_ano = True

                if ok_mes and ok_ano:
                    break

            except Exception as e:
                self._log("  fill comp frame {}: {}".format(f.url[:50], e))

        self._log("Competência {}/{} — mes={} ano={}".format(
            self.comp_mes, self.comp_ano, ok_mes, ok_ano))

        # Pausa extra para o portal processar onblur/onchange
        time.sleep(0.5)

    def _tem_confirmacao(self, page):
        """
        Detecta tela de CONFIRMAÇÃO DO ENCERRAMENTO em qualquer aba/frame do contexto.
        Aguarda até 10s pois a confirmação pode abrir em nova aba via window.open().
        """
        padroes = [
            r"CONFIRMAÇÃO.*ENCERRAMENTO",
            r"SE DESEJA ENCERRAR",
            r"TOTAL FATURADO",
            r"TOTAL IMPOSTO",
            r"CLIQUE AQUI",
        ]
        # Aguarda até 10s (a nova aba pode demorar para abrir)
        for _ in range(10):
            # Verifica TODAS as abas do contexto do browser
            try:
                todas_paginas = list(page.context.pages)
            except Exception:
                todas_paginas = [page]
            for p in todas_paginas:
                for f in self._iter_frames(p.main_frame):
                    for padrao in padroes:
                        try:
                            if f.get_by_text(re.compile(padrao, re.I)).count() > 0:
                                self._log("Confirmação detectada (aba {}): '{}'".format(
                                    p.url[:50], padrao))
                                return p  # retorna a página onde encontrou
                        except Exception:
                            pass
            time.sleep(1)
        self._log("Sem confirmação após 10s — sem movimento.")
        return None

    def _confirmar_encerramento(self, page):
        """
        Aguarda e clica em "SE DESEJA ENCERRAR A COMPETÊNCIA CLIQUE AQUI".
        Faz polling por até 20s porque a página de confirmação pode demorar.

        O portal tem dois links "CLIQUE AQUI":
          Positivo : "SE DESEJA ENCERRAR A COMPETÊNCIA, CLIQUE AQUI"   ← queremos este
          Negativo : "SE NÃO DESEJA EFETUAR O ENCERRAMENTO CLIQUE AQUI" ← ignorar

        Estratégia: JS percorre todos os <a>, verifica contexto do pai
        para distinguir positivo de negativo, e chama .click() nativo.
        """
        self._shot(page, "tela_confirmacao")

        script_conf = """() => {
            // Diagnóstico: lista todos os links visíveis
            var todos = Array.from(document.querySelectorAll('a')).map(function(a){
                return (a.innerText||a.textContent||'').trim().toUpperCase().slice(0,80);
            }).filter(function(t){ return t.length > 0; });

            var links = Array.from(document.querySelectorAll('a'));
            var candidatos = [];
            for (var lnk of links) {
                var txt = (lnk.innerText || lnk.textContent || '').trim().toUpperCase();
                if (!txt.includes('CLIQUE')) continue;
                // Sobe até 6 níveis para capturar contexto da célula da tabela
                var el = lnk.parentElement;
                var ctx = '';
                for (var i = 0; i < 6 && el; i++) {
                    ctx = (el.innerText || el.textContent || '').trim().toUpperCase();
                    if (ctx.includes('SE DESEJA') || ctx.includes('NAO DESEJA') ||
                        ctx.includes('NÃO DESEJA') || ctx.includes('ENCERRAMENTO'))
                        break;
                    el = el.parentElement;
                }
                candidatos.push({lnk:lnk, ctx:ctx, txt:txt});
            }

            // Link positivo: "SE DESEJA" no contexto, SEM "NÃO"
            for (var c of candidatos) {
                var pos = (c.ctx.includes('SE DESEJA') || c.ctx.includes('DESEJA ENCERRAR')) &&
                          !c.ctx.includes('NAO DESEJA') && !c.ctx.includes('NÃO DESEJA');
                if (pos) {
                    try { c.lnk.focus(); } catch(e){}
                    c.lnk.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
                    c.lnk.dispatchEvent(new MouseEvent('mouseup',  {bubbles:true,button:0}));
                    c.lnk.click();
                    return {ok:true, ctx:c.ctx.slice(0,120), todos:todos};
                }
            }
            // Fallback: único link CLIQUE na página → clica
            if (candidatos.length === 1) {
                candidatos[0].lnk.click();
                return {ok:true, fallback:true, ctx:'unico link CLIQUE', todos:todos};
            }
            return {ok:false, total:candidatos.length, todos:todos};
        }"""

        # Polling por até 20s (confirmação pode demorar para carregar)
        for poll in range(20):
            for f in self._todos_frames(page):
                try:
                    res = f.evaluate(script_conf)
                    if not res:
                        continue
                    # Log diagnóstico dos links disponíveis
                    if poll == 0 or (res.get("todos") and not res.get("ok")):
                        todos = res.get("todos", [])
                        if todos:
                            self._log("  Links na página (frame {}): {}".format(
                                f.url[:40], todos[:10]))
                    if res.get("ok"):
                        self._log("Confirmação clicada (poll={} frame {}): {}{}".format(
                            poll, f.url[:40], res.get("ctx","")[:80],
                            " [único]" if res.get("fallback") else ""))
                        time.sleep(3)
                        self._shot(page, "encerramento_confirmado")
                        return True
                except Exception as e:
                    if poll == 0:
                        self._log("  _confirmar frame {}: {}".format(f.url[:40], e))
            time.sleep(1)

        # Fallback final: Playwright locator — primeiro link com "clique aqui"
        for f in self._todos_frames(page):
            try:
                links = f.get_by_role("link", name=re.compile(r"clique\s+aqui", re.I)).all()
                if links:
                    links[0].click(timeout=5000)
                    self._log("Confirmação fallback locator (frame {}).".format(f.url[:40]))
                    time.sleep(3)
                    self._shot(page, "encerramento_confirmado")
                    return True
            except Exception:
                pass

        self._log("AVISO: link de confirmação não encontrado após 20s.")
        return False

    # ------------------------------------------------------------------ #
    # Clique nas abas PRESTADOR / TOMADOR                                  #
    # ------------------------------------------------------------------ #

    def _clicar_aba_modulo(self, page, modulo):
        """
        Clica na aba PRESTADOR ou TOMADOR com estratégias específicas do GissOnline.

        PROBLEMA OBSERVADO: o portal tem um <td> container cujo onclick contém
          /*clickprestador();*/ /*clicktomador();*/   (comentários JS — não executam!)
        O _clicar_link genérico encontra esse TD primeiro e clica nele sem efeito.

        SOLUÇÃO: chamar clickprestador() / clicktomador() diretamente via JS,
        ou buscar especificamente o elemento cujo onclick contém SOMENTE a função
        do módulo desejado (sem a outra função junto).
        """
        eh_prestador = "PREST" in modulo.upper()
        func_nome  = "clickprestador" if eh_prestador else "clicktomador"
        outro_func = "clicktomador"   if eh_prestador else "clickprestador"

        # Estratégia 1: chama a função JS diretamente em cada frame
        for f in self._todos_frames(page):
            try:
                ok = f.evaluate(
                    "(fn) => { if(typeof window[fn]==='function'){ window[fn](); return true; } return false; }",
                    func_nome
                )
                if ok:
                    self._log("Aba '{}' via {}() direto no frame {}.".format(
                        modulo, func_nome, f.url[:50]))
                    return True
            except Exception:
                pass

        # Estratégia 2: encontra elemento com onclick que contém SÓ a função
        # desejada (não a outra junto) — exclui containers com ambas
        script_aba = """([fn, outro]) => {
            const sels = 'a,button,img,input,td[onclick],span[onclick],div[onclick]';
            for (const el of document.querySelectorAll(sels)) {
                const oc = (el.getAttribute('onclick') || '').toLowerCase()
                              .replace(/\\/\\*[^*]*\\*\\//g,'');   // remove comentários /* */
                if (oc.includes(fn) && !oc.includes(outro)) {
                    el.scrollIntoView({block:'center', inline:'center'});
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0)
                        return {found:true, x: r.left+r.width/2, y: r.top+r.height/2,
                                tag:el.tagName, oc:oc.slice(0,80)};
                    // sem área visível — tenta click direto
                    el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
                    el.click();
                    return {found:true, synthetic:true, tag:el.tagName, oc:oc.slice(0,80)};
                }
            }
            return {found:false};
        }"""

        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_aba, [func_nome, outro_func])
                if not (res and res.get("found")):
                    continue
                if res.get("synthetic"):
                    self._log("Aba '{}' via onclick específico (frame {}): {}".format(
                        modulo, f.url[:50], res.get("oc","")))
                    return True
                # Coordenadas reais → mouse
                fx, fy = 0.0, 0.0
                try:
                    box_frame = f.frame_element().bounding_box()
                    if box_frame:
                        fx, fy = box_frame["x"], box_frame["y"]
                except Exception:
                    pass
                px, py = fx + res["x"], fy + res["y"]
                page.mouse.move(px, py)
                time.sleep(0.3)
                page.mouse.click(px, py)
                self._log("Aba '{}' mouse real ({:.0f},{:.0f}) frame {}: tag={} oc={}".format(
                    modulo, px, py, f.url[:40], res.get("tag"), res.get("oc","")[:60]))
                return True
            except Exception as e:
                self._log("  _clicar_aba frame {}: {}".format(f.url[:40], e))

        # Fallback: _clicar_link genérico
        self._log("Fallback _clicar_link para aba '{}'.".format(modulo))
        return self._clicar_link(page, modulo)

    # ------------------------------------------------------------------ #
    # Clique especializado nos links de encerramento                      #
    # ------------------------------------------------------------------ #

    def _clicar_encerrar(self, page, modulo, tipo):
        """
        Clica em "Encerrar Escrituração" ou "Encerrar Sem Movimento".
        Captura a popup que o portal abre via window.open().

        Retorna a página popup (ou True se não abriu popup).
        """
        eh_escrit    = (tipo == "escrituracao")
        textos_busca = (
            ["Encerrar Escrituração", "Encerrar Escrituracao", "Encerrar Escrit"]
            if eh_escrit else
            ["Encerrar Sem Movimento", "Encerrar sem movimento", "Sem Movimento"]
        )
        PORTAL = "wwwx.gissonline.com.br"

        # Registra handler de dialog (alert/confirm) antes de clicar
        def _aceitar_dialog(dialog):
            self._log("Dialog '{}': {}".format(dialog.type, dialog.message[:80]))
            try:
                dialog.accept()
            except Exception:
                pass
        try:
            page.on("dialog", _aceitar_dialog)
        except Exception:
            pass

        for f in self._todos_frames(page):
            if PORTAL not in f.url:
                continue
            for texto in textos_busca:
                try:
                    loc = f.get_by_role("link", name=re.compile(re.escape(texto), re.I))
                    if loc.count() == 0:
                        continue
                    loc.first.scroll_into_view_if_needed(timeout=3000)

                    # ── Tenta capturar popup que abre via window.open() ──
                    try:
                        with page.context.expect_page(timeout=6000) as popup_info:
                            loc.first.click(timeout=5000)
                        popup = popup_info.value
                        popup.bring_to_front()
                        popup.wait_for_load_state("domcontentloaded", timeout=20000)
                        self._log("[{}] '{}' → popup capturada: {} (frame {}).".format(
                            modulo, texto, popup.url[:60], f.url[:50]))
                        self._popup_encerramento = popup
                        return popup
                    except Exception:
                        # Sem popup — clique navegou na mesma página
                        self._log("[{}] '{}' clicado (sem popup) via locator (frame {}).".format(
                            modulo, texto, f.url[:50]))
                        return True
                except Exception as e:
                    self._log("  locator '{}' frame {}: {}".format(texto, f.url[:40], e))

        self._log("[{}] '{}' NÃO encontrado.".format(modulo, tipo))
        return False

    # ------------------------------------------------------------------ #
    # Encerramento por módulo                                              #
    # ------------------------------------------------------------------ #

    def _aguardar_link_visivel(self, page, textos, timeout_s=10):
        """
        Aguarda até que pelo menos um dos textos esteja visível em qualquer frame.
        Retorna o texto encontrado ou None se timeout.
        """
        import unicodedata
        def _norm(s):
            s = (s or "").strip().lower()
            s = "".join(c for c in unicodedata.normalize("NFD", s)
                        if unicodedata.category(c) != "Mn")
            return re.sub(r"\s+", " ", s)

        termos = [_norm(t) for t in textos]
        inicio = time.time()
        while time.time() - inicio < timeout_s:
            for f in self._todos_frames(page):
                try:
                    body = _norm(f.evaluate(
                        "() => document.body ? document.body.innerText : ''") or "")
                    for i, t in enumerate(termos):
                        if t in body:
                            self._log("Link visível detectado: '{}'.".format(textos[i]))
                            return textos[i]
                except Exception:
                    pass
            time.sleep(1)
        return None

    def _encerrar_modulo(self, page, modulo):
        """
        Fluxo PASSO A PASSO literal e sequencial:

        PASSO 1 — Clicar aba PRESTADOR ou TOMADOR
        PASSO 2 — Aguardar formulário com campo Mês/Ano
        PASSO 3 — Preencher Mês e Ano
        PASSO 4 — Clicar "Encerrar Escrituração"
        PASSO 5a — COM movimento: aguarda confirmação → clica "SE DESEJA ENCERRAR"
        PASSO 5b — SEM movimento: volta ao módulo → preenche competência
                   → clica "Encerrar Sem Movimento" → confirma
        """
        self._log("=" * 55)
        self._log("=== MODULO: {} ===".format(modulo))
        self._log("=" * 55)
        self._shot(page, "{}_inicio".format(modulo.lower()))

        # ── PASSO 1: clicar na aba do módulo ─────────────────────────────
        self._log("[{}] PASSO 1: clicar aba...".format(modulo))
        clicou_aba = False
        for tentativa in range(4):
            if self._clicar_aba_modulo(page, modulo):
                clicou_aba = True
                self._log("[{}] Aba clicada (tentativa {}).".format(modulo, tentativa + 1))
                break
            self._log("[{}] Aba não respondeu, aguardando...".format(modulo))
            time.sleep(3)

        if not clicou_aba:
            self._log("[{}] AVISO: aba não foi clicada após 4 tentativas.".format(modulo))

        # ── PASSO 2: aguardar formulário Mês/Ano aparecer ─────────────────
        self._log("[{}] PASSO 2: aguardando formulário (até 15s)...".format(modulo))
        time.sleep(3)
        # Verifica se apareceu campo de competência
        form_ok = False
        for _ in range(5):
            for f in self._todos_frames(page):
                for sel in ["input[name*='mes' i]", "input[id*='mes' i]",
                            "select[name*='mes' i]", "input[size='2']"]:
                    try:
                        if f.locator(sel).count() > 0:
                            form_ok = True
                            break
                    except Exception:
                        pass
                if form_ok:
                    break
            if form_ok:
                break
            time.sleep(2)
        self._log("[{}] Formulário visível: {}.".format(modulo, form_ok))
        self._shot(page, "{}_menu".format(modulo.lower()))

        # ── PASSO 3: preencher Mês e Ano ─────────────────────────────────
        self._log("[{}] PASSO 3: preencher Mês={} Ano={}.".format(
            modulo, self.comp_mes, self.comp_ano))
        self._preencher_competencia(page)
        time.sleep(1)
        self._shot(page, "{}_competencia".format(modulo.lower()))

        # ── PASSO 4: clicar "Encerrar Escrituração" ───────────────────────
        self._log("[{}] PASSO 4: clicar 'Encerrar Escrituração'...".format(modulo))
        clicou_escrit = self._clicar_encerrar(page, modulo, "escrituracao")

        if not clicou_escrit:
            self._log("[{}] 'Encerrar Escrituração' não encontrado.".format(modulo))
            self._shot(page, "{}_sem_escrit".format(modulo.lower()))

        # ── PASSO 5: aguardar tela de confirmação (pode abrir em nova aba) ──
        self._log("[{}] PASSO 5: aguardando resposta do portal...".format(modulo))

        # Se _clicar_encerrar capturou popup via expect_page, usá-la diretamente
        if hasattr(clicou_escrit, "url"):
            pagina_conf = clicou_escrit
            self._log("[{}] PASSO 5: usando popup capturada: {}".format(modulo, pagina_conf.url[:60]))
        else:
            time.sleep(3)
            self._shot(page, "{}_pos_encerrar_escrit".format(modulo.lower()))
            pagina_conf = self._tem_confirmacao(page)

        if pagina_conf:
            # ── PASSO 5a: COM movimento → confirma ────────────────────────
            self._log("[{}] PASSO 5a: confirmação detectada → clicando 'SE DESEJA ENCERRAR'.".format(modulo))
            self._confirmar_encerramento(pagina_conf)
            resultado = "ENCERRADO"
            self._log("[{}] Encerrado COM movimento.".format(modulo))

        else:
            # ── PASSO 5b: SEM movimento → "Encerrar Sem Movimento" ────────
            self._log("[{}] PASSO 5b: sem confirmação → SEM MOVIMENTO.".format(modulo))
            resultado = self._encerrar_sem_movimento(page, modulo)

        self._shot(page, "{}_concluido".format(modulo.lower()))
        self._save_txt(
            "{}_resultado".format(modulo.lower()),
            "\n".join(self.logs + [
                "",
                "Módulo     : {}".format(modulo),
                "Competência: {}".format(self.competencia),
                "Resultado  : {}".format(resultado),
            ])
        )
        self._log("=== {} CONCLUÍDO: {} ===".format(modulo, resultado))
        return resultado

    def _encerrar_sem_movimento(self, page, modulo):
        """
        SEM MOVIMENTO — fluxo sequencial:
          1. Volta ao módulo (clica aba PRESTADOR/TOMADOR)
          2. Aguarda formulário aparecer
          3. Preenche Mês/Ano
          4. Clica "Encerrar Sem Movimento"
          5. Aguarda e confirma na tela seguinte
        """
        self._log("[{}] === Encerrar Sem Movimento ===".format(modulo))
        self._shot(page, "{}_sem_movimento_inicio".format(modulo.lower()))

        # Passo 1: volta ao módulo
        self._log("[{}] SEM_MOV PASSO 1: clicar aba...".format(modulo))
        for tentativa in range(3):
            if self._clicar_aba_modulo(page, modulo):
                self._log("[{}] Aba clicada (tentativa {}).".format(modulo, tentativa + 1))
                break
            time.sleep(2)

        # Passo 2: aguarda formulário
        self._log("[{}] SEM_MOV PASSO 2: aguardando formulário...".format(modulo))
        time.sleep(3)

        # Passo 3: preenche competência
        self._log("[{}] SEM_MOV PASSO 3: preencher competência.".format(modulo))
        self._preencher_competencia(page)
        time.sleep(1)
        self._shot(page, "{}_competencia_sem_mov".format(modulo.lower()))

        # Passo 4: clica "Encerrar Sem Movimento"
        self._log("[{}] SEM_MOV PASSO 4: clicar 'Encerrar Sem Movimento'.".format(modulo))
        clicou = self._clicar_encerrar(page, modulo, "sem_movimento")

        if not clicou:
            self._shot(page, "{}_erro_sem_mov".format(modulo.lower()))
            raise RuntimeError(
                "'Encerrar Sem Movimento' não encontrado para {}.".format(modulo))

        # Passo 5: aguarda confirmação em qualquer aba do contexto
        self._log("[{}] SEM_MOV PASSO 5: aguardando confirmação...".format(modulo))

        # Se _clicar_encerrar capturou popup via expect_page, usá-la diretamente
        if hasattr(clicou, "url"):
            pagina_conf = clicou
            self._log("[{}] SEM_MOV PASSO 5: usando popup capturada: {}".format(modulo, pagina_conf.url[:60]))
        else:
            time.sleep(3)
            self._shot(page, "{}_pos_sem_movimento".format(modulo.lower()))
            pagina_conf = self._tem_confirmacao(page)

        self._confirmar_encerramento(pagina_conf if pagina_conf else page)
        self._log("[{}] Encerrado SEM movimento.".format(modulo))
        return "SEM_MOVIMENTO"

    def _abrir_janela_modulo(self, page, modulo):
        """Mantido por compatibilidade."""
        return self._clicar_aba_modulo(page, modulo)


    # ------------------------------------------------------------------ #
    # Diagnóstico: salva HTML de cada frame                               #
    # ------------------------------------------------------------------ #

    def _salvar_evidencias_frames(self, page, sufixo="frames"):
        import json as _json
        evidencias = []
        for idx, frame in enumerate(self._todos_frames(page)):
            item = {"idx": idx, "name": frame.name, "url": frame.url}
            try:
                item["texto"] = frame.evaluate(
                    "() => document.body ? document.body.innerText.slice(0,2000) : ''")
                html = frame.content()
                nome = "{}_{}_{}_frame{}.html".format(
                    self._stamp(), self._safe(self.cliente_nome), sufixo, idx)
                (self.download_dir / nome).write_text(html, encoding="utf-8", errors="replace")
                self.evidencias.append(nome)
            except Exception as e:
                item["erro"] = str(e)
            evidencias.append(item)

        nome_j = "{}_{}_{}_frames.json".format(
            self._stamp(), self._safe(self.cliente_nome), sufixo)
        (self.download_dir / nome_j).write_text(
            _json.dumps(evidencias, ensure_ascii=False, indent=2), encoding="utf-8")
        self.evidencias.append(nome_j)
        self._log("Evidências: {} frames salvos.".format(len(evidencias)))

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
                portal = self._aguardar_portal(page)

                if executar_prestados:
                    res = self._encerrar_modulo(portal, "PRESTADOR")
                    mensagens.append("Prestador: {}".format(res))

                if executar_tomados:
                    res = self._encerrar_modulo(portal, "TOMADOR")
                    mensagens.append("Tomador: {}".format(res))

            except Exception as e:
                self._log("ERRO FATAL: {}".format(e))
                try:
                    self._shot(page, "erro_geral")
                    self._salvar_evidencias_frames(page, "erro")
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
            "mensagem":   "; ".join(mensagens) if mensagens else "Sem ações executadas",
            "evidencias": self.evidencias,
        }
