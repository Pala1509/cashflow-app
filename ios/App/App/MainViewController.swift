import UIKit
import Capacitor

// Controlador principal de la app (reemplaza al CAPBridgeViewController
// genérico en Main.storyboard) solo para registrar los plugins propios de
// CashFlow que viven dentro del proyecto de iOS.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CashFlowWidgetPlugin())
    }
}
