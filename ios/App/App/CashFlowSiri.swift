import AppIntents
import Foundation
import UserNotifications

// "Anotar con Siri" — CashFlow
//
// Flujo:
//   1. "Oye Siri, anota algo en CashFlow"  →  Siri: "¿Qué movimiento anoto?"
//   2. "Compré un Amper de mango en el minimercado, valió 3.500"
//   3. Siri: "¿Cómo pagaste?"  →  "Efectivo" / "Nequi" / "la tarjeta Nu"…
//      (si la frase ya decía "…con Nequi", no pregunta)
//   4. Se guarda, Siri se cierra solita y llega una notificación con el
//      resumen ("Gasto anotado · Amper de mango en Minimercado · $3.500 ·
//      Alimentos · Efectivo").
//
// Hay 3 intents:
//   - AnotarGastoIntent      ("agrega un gasto…")   → siempre egreso
//   - AnotarIngresoIntent    ("agrega un ingreso…") → siempre ingreso
//   - AnotarMovimientoIntent ("anota algo…")        → el servidor deduce el tipo
//
// Todo el entendimiento de la frase pasa en la Edge Function
// `siri-movimiento` (Supabase). Aquí solo se habla con Siri.
//
// Auth: token propio guardado por la app con @capacitor/preferences
// (UserDefaults.standard, llave "CapacitorStorage.siri_token"). La app lo
// genera sola al iniciar sesión en el iPhone (ver src/lib/siri.ts).
//
// App Intents no necesita la capability de Siri ni entitlements.

private let urlFuncion = URL(string: "https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/siri-movimiento")!
private let llaveToken = "CapacitorStorage.siri_token"

/// Error que Siri lee en voz alta (sin dejar nada guardado).
@available(iOS 16.0, *)
struct ErrorSiri: Error, CustomLocalizedStringResourceConvertible {
    let texto: String
    var localizedStringResource: LocalizedStringResource { "\(texto)" }
}

@available(iOS 16.0, *)
enum ResultadoSiri {
    case listo
    case preguntarCuenta(String)
}

/// Manda la frase (y el método de pago si ya lo dijeron) al servidor.
/// - Si quedó guardado: muestra la notificación de resumen y devuelve .listo.
/// - Si falta saber con qué cuenta: devuelve .preguntarCuenta(pregunta).
/// - Si algo falla: lanza ErrorSiri con el mensaje para Siri.
@available(iOS 16.0, *)
private func procesar(frase: String, tipo: String?, metodo: String?) async throws -> ResultadoSiri {
    guard let token = UserDefaults.standard.string(forKey: llaveToken), !token.isEmpty else {
        throw ErrorSiri(texto: "Primero abre CashFlow una vez con tu cuenta para conectar Siri.")
    }

    var req = URLRequest(url: urlFuncion)
    req.httpMethod = "POST"
    req.timeoutInterval = 15
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue(token, forHTTPHeaderField: "x-siri-token")
    var body: [String: Any] = ["frase": frase, "preguntarCuenta": true]
    if let tipo { body["tipo"] = tipo }
    if let metodo, !metodo.trimmingCharacters(in: .whitespaces).isEmpty { body["metodo"] = metodo }
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)

    // Sesión nueva en cada llamada: con URLSession.shared, la segunda
    // solicitud (después de "¿Cómo pagaste?") reutilizaba una conexión
    // HTTP/3 que iOS ya había cerrado y fallaba sin llegar al servidor.
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 15
    config.waitsForConnectivity = false
    let sesion = URLSession(configuration: config)
    defer { sesion.finishTasksAndInvalidate() }

    var data: Data?
    for intento in 0..<2 {
        do {
            (data, _) = try await sesion.data(for: req)
            break
        } catch {
            if intento == 0 { try? await Task.sleep(nanoseconds: 400_000_000) }
        }
    }
    guard let data else {
        throw ErrorSiri(texto: "No tengo conexión para anotarlo ahora. Intenta de nuevo en un momento.")
    }
    let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]

    if json["necesitaCuenta"] as? Bool == true {
        return .preguntarCuenta((json["pregunta"] as? String) ?? "¿Cómo pagaste?")
    }
    guard json["ok"] as? Bool == true else {
        throw ErrorSiri(texto: (json["mensaje"] as? String) ?? "No pude anotar el movimiento. Intenta de nuevo.")
    }

    if let notif = json["notificacion"] as? [String: Any] {
        await mostrarNotificacion(
            titulo: (notif["titulo"] as? String) ?? "Movimiento anotado",
            cuerpo: (notif["cuerpo"] as? String) ?? ""
        )
    }
    return .listo
}

/// Notificación local con el resumen, para que Siri se pueda cerrar de una
/// sin quedarse leyendo/mostrando el resultado.
private func mostrarNotificacion(titulo: String, cuerpo: String) async {
    let contenido = UNMutableNotificationContent()
    contenido.title = titulo
    contenido.body = cuerpo
    contenido.threadIdentifier = "cashflow-siri"
    let solicitud = UNNotificationRequest(identifier: UUID().uuidString, content: contenido, trigger: nil)
    try? await UNUserNotificationCenter.current().add(solicitud)
}


/// Envía el movimiento y, si el servidor necesita saber la cuenta, le
/// pregunta al usuario ahí mismo (sin reiniciar el intent) hasta 2 veces.
@available(iOS 16.0, *)
private func anotar(frase: String, tipo: String?, metodo: String?,
                    preguntar: (String) async throws -> String?) async throws {
    var actual = metodo
    for _ in 0..<3 {
        switch try await procesar(frase: frase, tipo: tipo, metodo: actual) {
        case .listo:
            return
        case .preguntarCuenta(let pregunta):
            actual = try await preguntar(pregunta)
        }
    }
    throw ErrorSiri(texto: "No logré saber la cuenta. Ábrelo en CashFlow para terminar de anotarlo.")
}

// MARK: - Intents

@available(iOS 16.0, *)
struct AnotarGastoIntent: AppIntent {
    static var title: LocalizedStringResource = "Agregar gasto"
    static var description = IntentDescription("Anota un gasto en CashFlow diciéndolo con tu voz.")
    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Gasto",
        description: "Por ejemplo: un Amper de mango en el minimercado, valió 3.500",
        requestValueDialog: IntentDialog("¿Qué gasto anoto?")
    )
    var frase: String

    @Parameter(title: "Método de pago", description: "Efectivo, Nequi, Bancolombia, la tarjeta…")
    var metodo: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Agregar el gasto \(\.$frase) en CashFlow")
    }

    func perform() async throws -> some IntentResult {
        try await anotar(frase: frase, tipo: "egreso", metodo: metodo) { pregunta in
            let respuesta: String? = try await $metodo.requestValue(IntentDialog("\(pregunta)"))
            return respuesta
        }
        return .result()
    }
}

@available(iOS 16.0, *)
struct AnotarIngresoIntent: AppIntent {
    static var title: LocalizedStringResource = "Agregar ingreso"
    static var description = IntentDescription("Anota un ingreso en CashFlow diciéndolo con tu voz.")
    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Ingreso",
        description: "Por ejemplo: el freelance de Icone, 800 mil",
        requestValueDialog: IntentDialog("¿Qué ingreso anoto?")
    )
    var frase: String

    @Parameter(title: "Cuenta", description: "A qué cuenta te llegó: Nequi, Bancolombia, efectivo…")
    var metodo: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Agregar el ingreso \(\.$frase) en CashFlow")
    }

    func perform() async throws -> some IntentResult {
        try await anotar(frase: frase, tipo: "ingreso", metodo: metodo) { pregunta in
            let respuesta: String? = try await $metodo.requestValue(IntentDialog("\(pregunta)"))
            return respuesta
        }
        return .result()
    }
}

@available(iOS 16.0, *)
struct AnotarMovimientoIntent: AppIntent {
    static var title: LocalizedStringResource = "Anotar movimiento"
    static var description = IntentDescription("Anota un gasto o un ingreso en CashFlow diciéndolo con tu voz.")
    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Movimiento",
        description: "Por ejemplo: compré un Amper de mango en el minimercado, valió 3.500",
        requestValueDialog: IntentDialog("¿Qué movimiento anoto?")
    )
    var frase: String

    @Parameter(title: "Método de pago", description: "Efectivo, Nequi, Bancolombia, la tarjeta…")
    var metodo: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Anotar \(\.$frase) en CashFlow")
    }

    func perform() async throws -> some IntentResult {
        try await anotar(frase: frase, tipo: nil, metodo: metodo) { pregunta in
            let respuesta: String? = try await $metodo.requestValue(IntentDialog("\(pregunta)"))
            return respuesta
        }
        return .result()
    }
}

// MARK: - Frases de Siri

@available(iOS 16.0, *)
struct CashFlowShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AnotarGastoIntent(),
            phrases: [
                "Anota un gasto en \(.applicationName)",
                "Anota un gasto a \(.applicationName)",
                "Anota una compra en \(.applicationName)",
                "Anota una compra a \(.applicationName)",
                "Anota un pago en \(.applicationName)",
                "Anota un pago a \(.applicationName)",
                "Apunta un gasto en \(.applicationName)",
                "Apunta un gasto a \(.applicationName)",
                "Apunta una compra en \(.applicationName)",
                "Apunta una compra a \(.applicationName)",
                "Apunta un pago en \(.applicationName)",
                "Apunta un pago a \(.applicationName)",
                "Agrega un gasto en \(.applicationName)",
                "Agrega un gasto a \(.applicationName)",
                "Agrega una compra en \(.applicationName)",
                "Agrega una compra a \(.applicationName)",
                "Agrega un pago en \(.applicationName)",
                "Agrega un pago a \(.applicationName)",
                "Añade un gasto en \(.applicationName)",
                "Añade un gasto a \(.applicationName)",
                "Añade una compra en \(.applicationName)",
                "Añade una compra a \(.applicationName)",
                "Añade un pago en \(.applicationName)",
                "Añade un pago a \(.applicationName)",
                "Registra un gasto en \(.applicationName)",
                "Registra un gasto a \(.applicationName)",
                "Registra una compra en \(.applicationName)",
                "Registra una compra a \(.applicationName)",
                "Registra un pago en \(.applicationName)",
                "Registra un pago a \(.applicationName)",
                "Guarda un gasto en \(.applicationName)",
                "Guarda un gasto a \(.applicationName)",
                "Guarda una compra en \(.applicationName)",
                "Guarda una compra a \(.applicationName)",
                "Guarda un pago en \(.applicationName)",
                "Guarda un pago a \(.applicationName)",
                "Mete un gasto en \(.applicationName)",
                "Mete un gasto a \(.applicationName)",
                "Mete una compra en \(.applicationName)",
                "Mete una compra a \(.applicationName)",
                "Mete un pago en \(.applicationName)",
                "Mete un pago a \(.applicationName)",
                "Pon un gasto en \(.applicationName)",
                "Pon un gasto a \(.applicationName)",
                "Pon una compra en \(.applicationName)",
                "Pon una compra a \(.applicationName)",
                "Pon un pago en \(.applicationName)",
                "Pon un pago a \(.applicationName)",
                "Nuevo gasto en \(.applicationName)",
                "Gasto en \(.applicationName)",
                "Gasté en \(.applicationName)",
                "Agregar un gasto en \(.applicationName)",
                "Anotar un gasto en \(.applicationName)",
            ],
            shortTitle: "Agregar gasto",
            systemImageName: "arrow.up.circle.fill"
        )
        AppShortcut(
            intent: AnotarIngresoIntent(),
            phrases: [
                "Anota un ingreso en \(.applicationName)",
                "Anota un ingreso a \(.applicationName)",
                "Anota una entrada en \(.applicationName)",
                "Anota una entrada a \(.applicationName)",
                "Apunta un ingreso en \(.applicationName)",
                "Apunta un ingreso a \(.applicationName)",
                "Apunta una entrada en \(.applicationName)",
                "Apunta una entrada a \(.applicationName)",
                "Agrega un ingreso en \(.applicationName)",
                "Agrega un ingreso a \(.applicationName)",
                "Agrega una entrada en \(.applicationName)",
                "Agrega una entrada a \(.applicationName)",
                "Añade un ingreso en \(.applicationName)",
                "Añade un ingreso a \(.applicationName)",
                "Añade una entrada en \(.applicationName)",
                "Añade una entrada a \(.applicationName)",
                "Registra un ingreso en \(.applicationName)",
                "Registra un ingreso a \(.applicationName)",
                "Registra una entrada en \(.applicationName)",
                "Registra una entrada a \(.applicationName)",
                "Guarda un ingreso en \(.applicationName)",
                "Guarda un ingreso a \(.applicationName)",
                "Guarda una entrada en \(.applicationName)",
                "Guarda una entrada a \(.applicationName)",
                "Mete un ingreso en \(.applicationName)",
                "Mete un ingreso a \(.applicationName)",
                "Mete una entrada en \(.applicationName)",
                "Mete una entrada a \(.applicationName)",
                "Pon un ingreso en \(.applicationName)",
                "Pon un ingreso a \(.applicationName)",
                "Pon una entrada en \(.applicationName)",
                "Pon una entrada a \(.applicationName)",
                "Nuevo ingreso en \(.applicationName)",
                "Ingreso en \(.applicationName)",
                "Me pagaron, anótalo en \(.applicationName)",
                "Agregar un ingreso en \(.applicationName)",
                "Anotar un ingreso en \(.applicationName)",
            ],
            shortTitle: "Agregar ingreso",
            systemImageName: "arrow.down.circle.fill"
        )
        AppShortcut(
            intent: AnotarMovimientoIntent(),
            phrases: [
                "Anota algo en \(.applicationName)",
                "Anota algo a \(.applicationName)",
                "Anota un movimiento en \(.applicationName)",
                "Anota un movimiento a \(.applicationName)",
                "Apunta algo en \(.applicationName)",
                "Apunta algo a \(.applicationName)",
                "Apunta un movimiento en \(.applicationName)",
                "Apunta un movimiento a \(.applicationName)",
                "Agrega algo en \(.applicationName)",
                "Agrega algo a \(.applicationName)",
                "Agrega un movimiento en \(.applicationName)",
                "Agrega un movimiento a \(.applicationName)",
                "Añade algo en \(.applicationName)",
                "Añade algo a \(.applicationName)",
                "Añade un movimiento en \(.applicationName)",
                "Añade un movimiento a \(.applicationName)",
                "Registra algo en \(.applicationName)",
                "Registra algo a \(.applicationName)",
                "Registra un movimiento en \(.applicationName)",
                "Registra un movimiento a \(.applicationName)",
                "Guarda algo en \(.applicationName)",
                "Guarda algo a \(.applicationName)",
                "Guarda un movimiento en \(.applicationName)",
                "Guarda un movimiento a \(.applicationName)",
                "Mete algo en \(.applicationName)",
                "Mete algo a \(.applicationName)",
                "Mete un movimiento en \(.applicationName)",
                "Mete un movimiento a \(.applicationName)",
                "Pon algo en \(.applicationName)",
                "Pon algo a \(.applicationName)",
                "Pon un movimiento en \(.applicationName)",
                "Pon un movimiento a \(.applicationName)",
                "Anota en \(.applicationName)",
                "Apunta en \(.applicationName)",
                "Agrega en \(.applicationName)",
                "Registra en \(.applicationName)",
                "Anotar en \(.applicationName)",
                "Nuevo movimiento en \(.applicationName)",
                "Agregar un movimiento en \(.applicationName)",
            ],
            shortTitle: "Anotar movimiento",
            systemImageName: "mic.fill"
        )
    }
}
