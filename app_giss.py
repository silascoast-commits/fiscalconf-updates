"""
app_giss.py — Interface gráfica para o GissBot
Execute: python app_giss.py
"""
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import sys
import io
import os
from pathlib import Path


# Redireciona print() para o widget de log
class _LogRedirect(io.TextIOBase):
    def __init__(self, widget: scrolledtext.ScrolledText):
        self._w = widget

    def write(self, msg):
        self._w.after(0, self._append, msg)
        return len(msg)

    def _append(self, msg):
        self._w.configure(state="normal")
        self._w.insert(tk.END, msg)
        self._w.see(tk.END)
        self._w.configure(state="disabled")

    def flush(self):
        pass


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("GissBot — Encerramento de Escrituração")
        self.resizable(False, False)
        self._build()

    def _build(self):
        pad = {"padx": 10, "pady": 6}

        # ── Credenciais ──────────────────────────────────────────────
        frame_cred = ttk.LabelFrame(self, text="Credenciais GissOnline")
        frame_cred.grid(row=0, column=0, columnspan=2, sticky="ew", **pad)

        ttk.Label(frame_cred, text="Usuário (CMC):").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        self.var_usuario = tk.StringVar()
        ttk.Entry(frame_cred, textvariable=self.var_usuario, width=28).grid(row=0, column=1, padx=8, pady=4)

        ttk.Label(frame_cred, text="Senha:").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        self.var_senha = tk.StringVar()
        ttk.Entry(frame_cred, textvariable=self.var_senha, show="*", width=28).grid(row=1, column=1, padx=8, pady=4)

        ttk.Label(frame_cred, text="Competência (MM/AAAA):").grid(row=2, column=0, sticky="w", padx=8, pady=4)
        self.var_comp = tk.StringVar(value="04/2026")
        ttk.Entry(frame_cred, textvariable=self.var_comp, width=12).grid(row=2, column=1, sticky="w", padx=8, pady=4)

        # ── Módulos ───────────────────────────────────────────────────
        frame_mod = ttk.LabelFrame(self, text="Módulos")
        frame_mod.grid(row=1, column=0, columnspan=2, sticky="ew", **pad)

        self.var_prestador = tk.BooleanVar(value=True)
        self.var_tomador   = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame_mod, text="Prestador", variable=self.var_prestador).grid(row=0, column=0, padx=16, pady=4)
        ttk.Checkbutton(frame_mod, text="Tomador",   variable=self.var_tomador).grid(row=0, column=1, padx=16, pady=4)

        # ── Botão ──────────────────────────────────────────────────────
        self.btn = ttk.Button(self, text="▶  Executar", command=self._executar)
        self.btn.grid(row=2, column=0, columnspan=2, pady=(4, 2))

        # ── Log ────────────────────────────────────────────────────────
        frame_log = ttk.LabelFrame(self, text="Log")
        frame_log.grid(row=3, column=0, columnspan=2, sticky="nsew", **pad)

        self.log = scrolledtext.ScrolledText(frame_log, width=72, height=22, state="disabled",
                                             font=("Consolas", 9))
        self.log.pack(fill="both", expand=True, padx=4, pady=4)

    def _executar(self):
        usuario = self.var_usuario.get().strip()
        senha   = self.var_senha.get().strip()
        comp    = self.var_comp.get().strip()

        if not usuario or not senha or not comp:
            messagebox.showerror("Campos obrigatórios", "Preencha Usuário, Senha e Competência.")
            return

        if not self.var_prestador.get() and not self.var_tomador.get():
            messagebox.showerror("Módulos", "Selecione ao menos um módulo.")
            return

        self.btn.configure(state="disabled", text="Executando…")
        self.log.configure(state="normal")
        self.log.delete("1.0", tk.END)
        self.log.configure(state="disabled")

        # Redireciona stdout para o widget
        sys.stdout = _LogRedirect(self.log)

        threading.Thread(target=self._rodar, args=(usuario, senha, comp), daemon=True).start()

    def _rodar(self, usuario, senha, comp):
        try:
            from robo_giss import GissBot
            config = {
                "usuario":     usuario,
                "senha":       senha,
                "competencia": comp,
                "cliente_nome": usuario,
                "download_dir": str(Path.home() / "GissBot_evidencias"),
                "headless":    True,
            }
            bot = GissBot(config)
            resultado = bot.run(
                executar_prestados=self.var_prestador.get(),
                executar_tomados=self.var_tomador.get(),
            )
            self.after(0, self._concluido, resultado)
        except Exception as e:
            self.after(0, self._erro, str(e))

    def _concluido(self, resultado):
        sys.stdout = sys.__stdout__
        self.btn.configure(state="normal", text="▶  Executar")
        messagebox.showinfo(
            "Concluído ✓",
            "Status: {}\n{}\n\nEvidências salvas em:\n{}".format(
                resultado["status"],
                resultado["mensagem"],
                str(Path.home() / "GissBot_evidencias"),
            )
        )

    def _erro(self, msg):
        sys.stdout = sys.__stdout__
        self.btn.configure(state="normal", text="▶  Executar")
        messagebox.showerror("Erro", msg)


if __name__ == "__main__":
    App().mainloop()
