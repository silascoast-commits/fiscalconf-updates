import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import { ClienteProvider } from "./contexts/ClienteContext";
import Layout from "./components/Layout";
import Consulta from "./pages/Consulta";
import GerenciarNCMs from "./pages/GerenciarNCMs";
import Historico from "./pages/Historico";
import Simulador from "./pages/Simulador";
import Apuracao from "./pages/Apuracao";
import Atualizacoes from "./pages/Atualizacoes";
import CalcPorDentro from "./pages/CalcPorDentro";
import Capa from "./pages/Capa";
import Dashboard from "./pages/Dashboard";
import Calendario from "./pages/Calendario";
import Clientes from "./pages/Clientes";
import Comparativo from "./pages/Comparativo";
import XmlImport from "./pages/XmlImport";
import ConsultorIA from "./pages/ConsultorIA";
import MapaTransicao from "./pages/MapaTransicao";
import KitPrompts from "./pages/KitPrompts";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ClienteProvider>
        <Router hook={useHashLocation}>
          <Switch>
            {/* Capa: sem navbar, tela cheia */}
            <Route path="/capa" component={Capa} />
            {/* App principal com navbar */}
            <Route>
              <Layout>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/consulta" component={Consulta} />
                  <Route path="/ncms" component={GerenciarNCMs} />
                  <Route path="/historico" component={Historico} />
                  <Route path="/simulador" component={Simulador} />
                  <Route path="/apuracao" component={Apuracao} />
                  <Route path="/atualizacoes" component={Atualizacoes} />
                  <Route path="/calculadora" component={CalcPorDentro} />
                  <Route path="/calendario" component={Calendario} />
                  <Route path="/clientes" component={Clientes} />
                  <Route path="/comparativo" component={Comparativo} />
                  <Route path="/xml" component={XmlImport} />
                  <Route path="/consultor" component={ConsultorIA} />
                  <Route path="/mapa" component={MapaTransicao} />
                  <Route path="/kit" component={KitPrompts} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </Route>
          </Switch>
        </Router>
        <Toaster />
        </ClienteProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
