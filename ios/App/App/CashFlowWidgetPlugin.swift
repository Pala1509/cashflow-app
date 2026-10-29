import Foundation
import Capacitor
import WidgetKit

// Puente JS → widget de iPhone. Mismo nombre y métodos que el plugin de
// Android (CashFlowWidgetPlugin.java), así src/lib/widget.ts no cambia:
// la app llama updateBalance / updateResumenMes / updateRecientes y aquí se
// guardan en el App Group para que el widget (CashFlowWidget.swift) los lea,
// y se le pide al sistema que repinte el widget.
//
// Requiere la capability "App Groups" con group.studio.vantalab.cashflow en
// los targets App y CashFlowWidgetExtension. Sin eso no falla nada: el
// widget solo muestra "Abre CashFlow".
@objc(CashFlowWidgetPlugin)
public class CashFlowWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CashFlowWidgetPlugin"
    public let jsName = "CashFlowWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateBalance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateRecientes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateResumenMes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLaunchAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cerrarVentanaRapida", returnType: CAPPluginReturnPromise),
    ]

    private let datos = UserDefaults(suiteName: "group.studio.vantalab.cashflow")

    private func guardar(_ valores: [String: String?]) {
        for (llave, valor) in valores {
            if let valor { datos?.set(valor, forKey: llave) }
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc func updateBalance(_ call: CAPPluginCall) {
        guardar(["balance_text": call.getString("balanceText")])
        call.resolve()
    }

    @objc func updateRecientes(_ call: CAPPluginCall) {
        guardar(["recientes_texto": call.getString("lineas")])
        call.resolve()
    }

    @objc func updateResumenMes(_ call: CAPPluginCall) {
        guardar(["ingresos_mes": call.getString("ingresos"), "egresos_mes": call.getString("egresos")])
        call.resolve()
    }

    // En iPhone los botones del widget abren la app con un enlace
    // (cashflow://nuevo?tipo=…) que maneja useWidgetLaunch.ts; esto queda
    // por compatibilidad con Android.
    @objc func getLaunchAction(_ call: CAPPluginCall) {
        call.resolve(["action": "none"])
    }

    @objc func cerrarVentanaRapida(_ call: CAPPluginCall) {
        call.resolve()
    }
}
