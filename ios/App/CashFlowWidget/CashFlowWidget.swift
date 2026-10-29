//
//  CashFlowWidget.swift
//  CashFlowWidget
//
//  Widget de CashFlow para iPhone (pantalla de inicio y pantalla de bloqueo).
//
//  - Pequeño: saldo total; tocarlo abre "Nuevo gasto".
//  - Mediano: saldo, ingresos/egresos del mes y botones + Ingreso / − Gasto.
//  - Pantalla de bloqueo: saldo (rectangular) y un botón "+" (circular).
//
//  Los datos los escribe la app (CashFlowWidgetPlugin.swift) en el App Group
//  "group.studio.vantalab.cashflow" cada vez que recalcula los totales. Si el
//  App Group no está activado (capability en Xcode), el widget igual
//  funciona: muestra "Abre CashFlow" y los botones siguen abriendo la app.
//
//  Los botones abren la app con un enlace cashflow://nuevo?tipo=… que la app
//  convierte en la pantalla de nuevo movimiento (ver useWidgetLaunch.ts).
//

import WidgetKit
import SwiftUI

private let grupo = "group.studio.vantalab.cashflow"
private let lima = Color(red: 198 / 255, green: 255 / 255, blue: 77 / 255)
private let coral = Color(red: 255 / 255, green: 122 / 255, blue: 110 / 255)
private let fondo = Color(red: 19 / 255, green: 19 / 255, blue: 19 / 255)
private let gris = Color(red: 154 / 255, green: 154 / 255, blue: 158 / 255)

private let urlGasto = URL(string: "cashflow://nuevo?tipo=egreso")!
private let urlIngreso = URL(string: "cashflow://nuevo?tipo=ingreso")!

struct DatosCashFlow: TimelineEntry {
    let date: Date
    let saldo: String?
    let ingresosMes: String?
    let egresosMes: String?

    static let ejemplo = DatosCashFlow(date: Date(), saldo: "$2.450.000", ingresosMes: "$3.200.000", egresosMes: "$1.180.000")

    static func leer() -> DatosCashFlow {
        let d = UserDefaults(suiteName: grupo)
        return DatosCashFlow(
            date: Date(),
            saldo: d?.string(forKey: "balance_text"),
            ingresosMes: d?.string(forKey: "ingresos_mes"),
            egresosMes: d?.string(forKey: "egresos_mes")
        )
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> DatosCashFlow { .ejemplo }

    func getSnapshot(in context: Context, completion: @escaping (DatosCashFlow) -> Void) {
        let datos = DatosCashFlow.leer()
        completion(context.isPreview && datos.saldo == nil ? .ejemplo : datos)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DatosCashFlow>) -> Void) {
        // La app pide recargar el widget cada vez que cambian los datos;
        // esto es solo un respaldo cada 30 minutos.
        let siguiente = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [DatosCashFlow.leer()], policy: .after(siguiente)))
    }
}

// MARK: - Vistas

struct Marca: View {
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(lima).frame(width: 7, height: 7)
            Text("CashFlow").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
        }
    }
}

struct Saldo: View {
    let texto: String?
    var tamano: CGFloat = 24
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Saldo total").font(.system(size: 11)).foregroundStyle(gris)
            Text(texto ?? "Abre CashFlow")
                .font(.system(size: texto == nil ? 15 : tamano, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
    }
}

struct Boton: View {
    let titulo: String
    let simbolo: String
    let color: Color
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: simbolo).font(.system(size: 12, weight: .bold))
            Text(titulo).font(.system(size: 12, weight: .bold))
        }
        .foregroundStyle(.black)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct VistaPequena: View {
    let datos: DatosCashFlow
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Marca()
            Spacer()
            Saldo(texto: datos.saldo, tamano: 22)
            Spacer()
            Boton(titulo: "Gasto", simbolo: "minus", color: coral)
        }
    }
}

struct VistaMediana: View {
    let datos: DatosCashFlow
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Marca()
                Spacer()
                Saldo(texto: datos.saldo, tamano: 26)
                Spacer()
                HStack(spacing: 8) {
                    Link(destination: urlIngreso) { Boton(titulo: "Ingreso", simbolo: "plus", color: lima) }
                    Link(destination: urlGasto) { Boton(titulo: "Gasto", simbolo: "minus", color: coral) }
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Este mes").font(.system(size: 11)).foregroundStyle(gris)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ingresos").font(.system(size: 10)).foregroundStyle(gris)
                    Text(datos.ingresosMes ?? "—").font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(lima).minimumScaleFactor(0.6).lineLimit(1)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("Egresos").font(.system(size: 10)).foregroundStyle(gris)
                    Text(datos.egresosMes ?? "—").font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(coral).minimumScaleFactor(0.6).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .frame(width: 105, alignment: .leading)
        }
    }
}

struct VistaBloqueoRectangular: View {
    let datos: DatosCashFlow
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("CashFlow").font(.system(size: 11, weight: .semibold))
            Text(datos.saldo ?? "Abre CashFlow").font(.system(size: 17, weight: .bold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1)
            Text("Saldo total").font(.system(size: 10))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct VistaBloqueoCircular: View {
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image(systemName: "plus").font(.system(size: 20, weight: .bold))
        }
    }
}

struct CashFlowWidgetEntryView: View {
    @Environment(\.widgetFamily) var familia
    var entry: DatosCashFlow

    var body: some View {
        switch familia {
        case .systemMedium:
            VistaMediana(datos: entry)
        case .accessoryRectangular:
            VistaBloqueoRectangular(datos: entry)
        case .accessoryCircular:
            VistaBloqueoCircular()
        default:
            VistaPequena(datos: entry)
        }
    }
}

struct CashFlowWidget: Widget {
    let kind: String = "CashFlowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            CashFlowWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { fondo }
                .widgetURL(urlGasto)
        }
        .configurationDisplayName("CashFlow")
        .description("Tu saldo y botones para anotar ingresos y gastos.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

#Preview(as: .systemMedium) {
    CashFlowWidget()
} timeline: {
    DatosCashFlow.ejemplo
}
