from playwright.sync_api import sync_playwright
import time, json

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-popup-blocking"],
    )
    ctx = browser.new_context(
        ignore_https_errors=True,
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 900},
    )
    page = ctx.new_page()

    print("Carregando pagina de login...")
    page.goto("https://portal.gissonline.com.br/login/index.html",
              wait_until="networkidle", timeout=30000)
    time.sleep(3)

    html = page.content()
    print("HTML ({} bytes):\n".format(len(html)))
    print(html[:5000])

    print("\n--- INPUTS ---")
    for inp in page.locator("input").all():
        try:
            attrs = page.evaluate("el => ({type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, visible: !!(el.offsetWidth || el.offsetHeight)})", inp.element_handle())
            print(attrs)
        except Exception as e:
            print("err:", e)

    print("\n--- IMAGENS (primeiras 30) ---")
    imgs = page.evaluate("""
        () => Array.from(document.querySelectorAll('img')).slice(0,30).map(i => ({
            src: i.src.slice(-60), w: i.naturalWidth, h: i.naturalHeight
        }))
    """)
    for img in imgs:
        print(img)

    page.screenshot(path="evidencias_giss/diagnostico_login.png", full_page=True)
    print("\nScreenshot salvo.")
    ctx.close()
    browser.close()
