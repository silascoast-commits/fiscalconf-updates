from robo_giss import GissBot

config = {
    "base_url":    "https://portal.gissonline.com.br/login/index.html",
    "usuario":     "260468",
    "senha":       "37056400",
    "competencia": "04/2026",
    "cliente_nome": "cliente_260468",
    "download_dir": "./evidencias_giss",
    "headless":    True,
}

bot = GissBot(config)
resultado = bot.run(executar_prestados=True, executar_tomados=True)
print("\n=== RESULTADO ===")
print("Status   :", resultado["status"])
print("Mensagem :", resultado["mensagem"])
print("Evidencias:")
for f in resultado["evidencias"]:
    print("  -", f)
