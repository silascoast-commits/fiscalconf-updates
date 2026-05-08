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

    def _clicar_link(self, page, texto, timeout_ms=3000):
        """
        Localiza elemento pelo texto/atributo em qualquer frame e clica.

        Estratégias (em ordem):
          1. Playwright locator direto no frame (mais confiável — gerencia
             coordenadas do frame automaticamente, dispara onclick corretamente)
          2. JS: localiza elemento folha → click() nativo no elemento
          3. JS: containers (td, span, div)
        """
        import unicodedata
        def _norm(s):
            s = (s or "").strip().lower()
            s = "".join(c for c in unicodedata.normalize("NFD", s)
                        if unicodedata.category(c) != "Mn")
            return re.sub(r"\s+", " ", s)

        termos = list({_norm(texto), texto.lower().strip()})

        # ── Estratégia 1: Playwright locator nativo (melhor para onclick) ──
        # frame.locator().click() gerencia o frame sem precisar calcular offsets
        regexp = re.compile(re.escape(texto), re.I)
        for frame in self._todos_frames(page):
            # Tenta primeiro <a> (links de navegação)
            for sel in ["a", "button", "input[type='button']",
                        "input[type='submit']", "td", "span", "li"]:
                try:
                    loc = frame.locator(sel).filter(has_text=regexp).first
                    if loc.count() > 0 and loc.is_visible(timeout=1000):
                        loc.scroll_into_view_if_needed(timeout=2000)
                        loc.click(timeout=timeout_ms)
                        self._log("Clicado '{}' locator '{}' (frame {}).".format(
                            texto, sel, frame.url[:50]))
                        return True
                except Exception:
                    pass
            # Atributos alt/title/value
            for attr in ["title", "alt", "value"]:
                try:
                    loc = frame.locator("[{}*='{}' i]".format(attr, texto)).first
                    if loc.count() > 0 and loc.is_visible(timeout=500):
                        loc.click(timeout=timeout_ms)
                        self._log("Clicado '{}' [{}] (frame {}).".format(
                            texto, attr, frame.url[:50]))
                        return True
                except Exception:
                    pass

        # Script JS passo 1: busca SOMENTE em elementos folha (a, button, img, input)
        # Evita pegar o <td> container que tem o texto de TODOS os links filhos
        script_folha = """(termos) => {
            const norm = s => {
                s = (s || '').trim().toLowerCase();
                return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\\s+/g,' ');
            };
            // Apenas elementos interativos folha — não containers
            const sels = 'a,button,input[type="button"],input[type="submit"],input[type="image"],img[onclick],img[usemap]';
            for (const el of document.querySelectorAll(sels)) {
                const txt = norm([
                    el.innerText, el.textContent, el.value,
                    el.alt, el.title,
                    el.getAttribute('href'),
                    el.getAttribute('onclick')
                ].filter(Boolean).join(' '));
                if (txt.length > 0 && txt.length < 300 &&
                        termos.some(t => txt.includes(t))) {
                    el.scrollIntoView({block:'center', inline:'center'});
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0)
                        return {found:true, tag:el.tagName,
                                x:r.left+r.width/2, y:r.top+r.height/2,
                                txt:txt.slice(0,80)};
                    el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
                    el.click();
                    return {found:true, synthetic:true, tag:el.tagName, txt:txt.slice(0,80)};
                }
            }
            return {found:false};
        }"""

        # Script JS passo 2: containers (td, span, div, li) — fallback se não achou link direto
        script_container = """(termos) => {
            const norm = s => {
                s = (s || '').trim().toLowerCase();
                return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\\s+/g,' ');
            };
            const sels = 'td[onclick],span[onclick],li[onclick],div[onclick],tr[onclick],td,span,li';
            for (const el of document.querySelectorAll(sels)) {
                // Texto DIRETO do elemento (sem filhos) para evitar container genérico
                const direto = norm((el.childNodes[0] && el.childNodes[0].nodeValue) || '');
                // Texto completo (inclui filhos)
                const txt = norm([
                    el.innerText, el.textContent, el.value,
                    el.alt, el.title,
                    el.getAttribute('href'),
                    el.getAttribute('onclick')
                ].filter(Boolean).join(' '));
                if (txt.length > 0 && txt.length < 200 &&
                        termos.some(t => txt.includes(t))) {
                    el.scrollIntoView({block:'center', inline:'center'});
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0)
                        return {found:true, tag:el.tagName,
                                x:r.left+r.width/2, y:r.top+r.height/2,
                                txt:txt.slice(0,80)};
                    el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
                    el.click();
                    return {found:true, synthetic:true, tag:el.tagName, txt:txt.slice(0,80)};
                }
            }
            return {found:false};
        }"""

        def _executar_click(res, f):
            """Executa o clique com mouse real nas coordenadas retornadas pelo JS."""
            if res.get("synthetic"):
                self._log("Clicado '{}' JS sintético (frame {}): tag={} txt={}".format(
                    texto, f.url[:50], res.get("tag"), res.get("txt","")[:60]))
                return True
            fx, fy = 0.0, 0.0
            try:
                box_frame = f.frame_element().bounding_box()
                if box_frame:
                    fx, fy = box_frame["x"], box_frame["y"]
            except Exception:
                pass
            px = fx + res["x"]
            py = fy + res["y"]
            page.mouse.move(px, py)
            time.sleep(0.25)
            page.mouse.click(px, py)
            self._log("Clicado '{}' mouse real ({:.0f},{:.0f}) frame {}: tag={} txt={}".format(
                texto, px, py, f.url[:40], res.get("tag"), res.get("txt","")[:60]))
            return True

        # Estratégia 1a: elementos folha (a, button, img) — preferência máxima
        # Evita pegar o <td> container que agrega o texto de todos os links filhos
        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_folha, termos)
                if res and res.get("found"):
                    return _executar_click(res, f)
            except Exception as e:
                self._log("  JS folha frame {}: {}".format(f.url[:40], e))

        # Estratégia 1b: containers (td, span, div) — fallback
        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_container, termos)
                if res and res.get("found"):
                    return _executar_click(res, f)
            except Exception as e:
                self._log("  JS container frame {}: {}".format(f.url[:40], e))

        # Estratégia 2: Playwright locator → hover() + click()
        regexp = re.compile(re.escape(texto), re.I)
        for frame in self._todos_frames(page):
            for sel in ["a", "button", "td", "li", "span", "div",
                        "input[type='button']", "input[type='submit']", "img"]:
                try:
                    loc = frame.locator(sel).filter(has_text=regexp).first
                    if loc.count() > 0:
                        loc.hover(timeout=timeout_ms)
                        time.sleep(0.2)
                        loc.click(timeout=timeout_ms)
                        self._log("Clicado '{}' hover+click locator '{}' (frame {}).".format(
                            texto, sel, frame.url[:40]))
                        return True
                except Exception:
                    pass
            for attr in ["title", "alt", "value"]:
                try:
                    loc = frame.locator("[{}*='{}' i]".format(attr, texto)).first
                    if loc.count() > 0:
                        loc.hover(timeout=timeout_ms)
                        time.sleep(0.2)
                        loc.click(timeout=timeout_ms)
                        self._log("Clicado '{}' hover+click [{}] (frame {}).".format(
                            texto, attr, frame.url[:40]))
                        return True
                except Exception:
                    pass

        self._log("Link NAO encontrado: '{}'".format(texto))
        return False

    def _preencher_competencia(self, page):
        """Preenche Mês e Ano em qualquer frame (input ou select)."""
        script = """([mes, ano]) => {
            var r = [];
            // Mês: input ou select
            var mesSelectors = [
                'select[name*="mes" i]','select[id*="mes" i]',
                'input[name*="mes" i]','input[id*="mes" i]','input[size="2"]'
            ];
            for (var s of mesSelectors) {
                var el = document.querySelector(s);
                if (el && el.type !== 'hidden') {
                    el.value = mes;
                    el.dispatchEvent(new Event('input',  {bubbles:true}));
                    el.dispatchEvent(new Event('change', {bubbles:true}));
                    r.push('mes'); break;
                }
            }
            // Ano: input ou select
            var anoSelectors = [
                'select[name*="ano" i]','select[id*="ano" i]',
                'input[name*="ano" i]','input[id*="ano" i]','input[size="4"]'
            ];
            for (var s of anoSelectors) {
                var el = document.querySelector(s);
                if (el && el.type !== 'hidden') {
                    el.value = ano;
                    el.dispatchEvent(new Event('input',  {bubbles:true}));
                    el.dispatchEvent(new Event('change', {bubbles:true}));
                    r.push('ano'); break;
                }
            }
            return r;
        }"""
        ok_mes = ok_ano = False
        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script, [self.comp_mes, self.comp_ano])
                for r in (res or []):
                    if r == "mes": ok_mes = True
                    if r == "ano": ok_ano = True
                if ok_mes and ok_ano:
                    break
            except Exception:
                pass

        # Fallback: locator direto — input e select
        if not ok_mes or not ok_ano:
            for f in self._todos_frames(page):
                for sel_base, val, flag in [
                    ("mes", self.comp_mes, "mes"),
                    ("ano", self.comp_ano, "ano"),
                ]:
                    if (flag == "mes" and ok_mes) or (flag == "ano" and ok_ano):
                        continue
                    sels = [
                        "select[name*='{}' i]".format(sel_base),
                        "select[id*='{}' i]".format(sel_base),
                        "input[name*='{}' i]".format(sel_base),
                        "input[id*='{}' i]".format(sel_base),
                    ]
                    for sel in sels:
                        try:
                            loc = f.locator(sel).first
                            if loc.count() > 0:
                                tag = loc.evaluate("el => el.tagName")
                                if tag == "SELECT":
                                    loc.select_option(val)
                                else:
                                    loc.triple_click()
                                    loc.fill(val)
                                if flag == "mes": ok_mes = True
                                else:             ok_ano  = True
                                break
                        except Exception:
                            pass
                    if (flag == "mes" and ok_mes) or (flag == "ano" and ok_ano):
                        break

        self._log("Competência {}/{} preenchida: mes={} ano={}".format(
            self.comp_mes, self.comp_ano, ok_mes, ok_ano))

        # Pressiona Tab para disparar onblur/onchange do campo Ano
        # Alguns portais só validam a competência após blur
        try:
            page.keyboard.press("Tab")
            time.sleep(0.5)
        except Exception:
            pass

    def _tem_confirmacao(self, page):
        """
        Detecta se apareceu a tela de CONFIRMAÇÃO DO ENCERRAMENTO
        (indica que a competência tem notas/movimento).
        Aguarda até 8s para a página carregar antes de verificar.
        """
        time.sleep(5)
        padroes = [
            r"CONFIRMAÇÃO.*ENCERRAMENTO",
            r"SE DESEJA ENCERRAR",
            r"TOTAL FATURADO",
            r"TOTAL IMPOSTO",
            r"CLIQUE AQUI",
        ]
        for padrao in padroes:
            for f in self._todos_frames(page):
                try:
                    if f.get_by_text(re.compile(padrao, re.I)).count() > 0:
                        self._log("Confirmação detectada: '{}'".format(padrao))
                        return True
                except Exception:
                    pass
        self._log("Sem confirmação — competência provavelmente sem movimento.")
        return False

    def _confirmar_encerramento(self, page):
        """
        Na tela de CONFIRMAÇÃO DO ENCERRAMENTO, clica em:
          "SE DESEJA ENCERRAR A COMPETÊNCIA CLIQUE AQUI"  ← primeiro link
        e NÃO em:
          "SE NÃO DESEJA EFETUAR O ENCERRAMENTO CLIQUE AQUI"  ← segundo link

        Estratégia: busca o texto âncora "SE DESEJA ENCERRAR" no HTML de cada
        frame e clica no link mais próximo a ele (que não tenha "NÃO").
        """
        self._shot(page, "tela_confirmacao")
        time.sleep(1)

        # Estratégia 1: clica no link cujo texto pai contém "SE DESEJA ENCERRAR"
        # mas NÃO contém "NÃO" — exclui o link de cancelamento
        script_conf = """() => {
            // Procura todos os links com texto "CLIQUE AQUI"
            var links = Array.from(document.querySelectorAll('a'));
            for (var lnk of links) {
                var txt = (lnk.innerText || lnk.textContent || '').trim().toUpperCase();
                if (!txt.includes('CLIQUE')) continue;
                // Verifica o texto ao redor (linha/célula) para distinguir dos dois links
                var parent = lnk.parentElement;
                var ctx = '';
                for (var i = 0; i < 3 && parent; i++) {
                    ctx = (parent.innerText || parent.textContent || '').toUpperCase();
                    if (ctx.includes('SE DESEJA') || ctx.includes('NÃO DESEJA') || ctx.includes('NAO DESEJA'))
                        break;
                    parent = parent.parentElement;
                }
                // Confirma se o contexto é "SE DESEJA ENCERRAR" (não o de cancelamento)
                if (ctx.includes('SE DESEJA') && !ctx.includes('NÃO DESEJA') && !ctx.includes('NAO DESEJA')) {
                    var r = lnk.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0)
                        return {found:true, x:r.left+r.width/2, y:r.top+r.height/2, ctx:ctx.slice(0,100)};
                    lnk.click();
                    return {found:true, synthetic:true, ctx:ctx.slice(0,100)};
                }
            }
            return {found:false};
        }"""

        for f in self._todos_frames(page):
            try:
                res = f.evaluate(script_conf)
                if not (res and res.get("found")):
                    continue
                self._log("Confirmação encontrada: {}".format(res.get("ctx","")[:80]))
                if res.get("synthetic"):
                    time.sleep(3)
                    self._shot(page, "encerramento_confirmado")
                    return True
                fx, fy = 0.0, 0.0
                try:
                    box_frame = f.frame_element().bounding_box()
                    if box_frame:
                        fx, fy = box_frame["x"], box_frame["y"]
                except Exception:
                    pass
                px, py = fx + res["x"], fy + res["y"]
                page.mouse.move(px, py)
                time.sleep(0.2)
                page.mouse.click(px, py)
                self._log("'SE DESEJA ENCERRAR CLIQUE AQUI' clicado ({:.0f},{:.0f}).".format(px, py))
                time.sleep(3)
                self._shot(page, "encerramento_confirmado")
                return True
            except Exception as e:
                self._log("  _confirmar frame {}: {}".format(f.url[:40], e))

        # Fallback: primeiro link com "CLIQUE" sem "NÃO" no texto do próprio link
        for f in self._todos_frames(page):
            try:
                for link in f.get_by_role("link").all():
                    txt = (link.inner_text() or "").strip().upper()
                    if "CLIQUE" in txt and "NÃO" not in txt and "NAO" not in txt:
                        link.click(timeout=5000)
                        self._log("Confirmação (fallback link): '{}'".format(txt[:60]))
                        time.sleep(3)
                        self._shot(page, "encerramento_confirmado")
                        return True
            except Exception:
                pass

        self._log("AVISO: link de confirmação não encontrado.")
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
    # Encerramento por módulo                                              #
    # ------------------------------------------------------------------ #

    def _encerrar_modulo(self, page, modulo):
        """
        Fluxo completo (documento PASSO_A_PASSO):

        1. Clica PRESTADOR/TOMADOR → preenche Mês/Ano → clica "Encerrar Escrituração"

        2a. COM movimento → confirmação aparece → "SE DESEJA ENCERRAR CLIQUE AQUI"
            → ENCERRADO

        2b. SEM movimento → confirmação NÃO aparece → volta ao módulo
            → preenche Mês/Ano → "Encerrar Sem Movimento"
            → confirmação SEMPRE aparece → "SE DESEJA ENCERRAR A COMPETÊNCIA CLIQUE AQUI"
            → SEM_MOVIMENTO
        """
        self._log("=" * 50)
        self._log("=== {} ===".format(modulo))
        self._log("=" * 50)
        self._shot(page, "{}_inicio".format(modulo.lower()))

        for _ in range(3):
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
                break
            except Exception:
                pass
        time.sleep(2)

        # ── Passo 1: navega para o módulo ────────────────────────────────
        for tentativa in range(4):
            if self._clicar_aba_modulo(page, modulo):
                self._log("Aba '{}' clicada (tentativa {}).".format(modulo, tentativa + 1))
                time.sleep(3)
                break
            self._log("Aba '{}' não respondeu (tentativa {}).".format(modulo, tentativa + 1))
            time.sleep(3)

        self._shot(page, "{}_menu".format(modulo.lower()))

        # ── Passo 2: preenche competência ────────────────────────────────
        self._preencher_competencia(page)
        time.sleep(1)
        self._shot(page, "{}_competencia".format(modulo.lower()))

        # ── Passo 3: clica "Encerrar Escrituração" ───────────────────────
        clicou_escrit = False
        for texto in ["Encerrar Escrituração", "Encerrar Escrituracao", "Encerrar Escrit"]:
            if self._clicar_link(page, texto):
                self._log("{}: 'Encerrar Escrituração' clicado.".format(modulo))
                clicou_escrit = True
                break

        if clicou_escrit:
            time.sleep(5)
            self._shot(page, "{}_pos_encerrar_escrit".format(modulo.lower()))

            # Passo 4a: tenta confirmar — se a tela de confirmação apareceu (COM movimento)
            if self._confirmar_encerramento(page):
                resultado = "ENCERRADO"
                self._log("{}: encerrado COM movimento.".format(modulo))

            else:
                # Passo 4b: SEM movimento — confirmação não apareceu
                self._log("{}: sem confirmação → sem movimento → usando 'Encerrar Sem Movimento'.".format(modulo))
                resultado = self._encerrar_sem_movimento(page, modulo)

        else:
            # "Encerrar Escrituração" não encontrado — tenta direto sem movimento
            self._log("{}: 'Encerrar Escrituração' não encontrado → usando 'Encerrar Sem Movimento'.".format(modulo))
            self._shot(page, "{}_sem_escrit".format(modulo.lower()))
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
        self._log("=== {} concluído: {} ===".format(modulo, resultado))
        return resultado

    def _encerrar_sem_movimento(self, page, modulo):
        """
        Volta ao módulo, preenche competência, clica 'Encerrar Sem Movimento'
        e confirma na tela seguinte ('SE DESEJA ENCERRAR A COMPETÊNCIA CLIQUE AQUI').
        Retorna 'SEM_MOVIMENTO'.
        """
        self._shot(page, "{}_sem_movimento_inicio".format(modulo.lower()))

        for _ in range(3):
            if self._clicar_aba_modulo(page, modulo):
                time.sleep(3)
                break
            time.sleep(2)

        self._preencher_competencia(page)
        time.sleep(1)
        self._shot(page, "{}_competencia_sem_mov".format(modulo.lower()))

        if not self._clicar_link(page, "Encerrar Sem Movimento"):
            self._shot(page, "{}_erro_sem_mov".format(modulo.lower()))
            self._salvar_evidencias_frames(page, "{}_erro_sem_mov".format(modulo.lower()))
            raise RuntimeError(
                "'Encerrar Sem Movimento' não encontrado para {}.".format(modulo))

        self._log("{}: 'Encerrar Sem Movimento' clicado.".format(modulo))
        time.sleep(5)
        self._shot(page, "{}_pos_sem_movimento".format(modulo.lower()))

        # SEMPRE confirma após "Encerrar Sem Movimento"
        self._confirmar_encerramento(page)
        self._log("{}: encerrado SEM movimento.".format(modulo))
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
