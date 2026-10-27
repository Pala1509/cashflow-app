package studio.vantalab.cashflow;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Ventana flotante mínima para "agregar rápido" desde el widget — es el
 * mismo bundle web de siempre (Capacitor/React), pero alojado en una
 * Activity con tema translúcido en vez de pantalla completa (ver
 * Theme.QuickAdd en styles.xml), y sin pasar por el splash animado ni por
 * el arranque normal de la app.
 *
 * React reconoce que llegó por acá leyendo el mismo extra del intent que ya
 * usa MainActivity (getLaunchAction, en CashFlowWidgetPlugin) — desde ahora,
 * los botones del widget SIEMPRE apuntan aquí, así que ese extra en la
 * práctica solo puede significar "estoy en la ventanita rápida" (ver
 * App.tsx). El "diálogo" en sí (el recuadro centrado, el fondo oscurecido)
 * lo pinta CSS/React, no vistas nativas — más simple y consistente con el
 * resto del diseño de la app que calcular tamaños de ventana en Java.
 */
public class QuickAddActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // El tema XML (Theme.QuickAdd — windowIsTranslucent, windowBackground
        // transparente) declara la intención, pero en actividades basadas en
        // AppCompat eso NO siempre alcanza — es un problema conocido de
        // Android: AppCompat arma su propio DecorView por dentro y a veces
        // ignora el windowBackground transparente del tema. Forzarlo acá,
        // directo sobre el Window de verdad, es lo que de verdad garantiza
        // que no quede nada opaco pintado detrás — y hay que hacerlo ANTES
        // de super.onCreate(), antes de que se arme el decor view.
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
        registerPlugin(CashFlowWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        // El WebView de Android pinta su propio fondo opaco por defecto,
        // sin importar que el tema de la Activity (Theme.QuickAdd) sea
        // translúcido — sin esto, aunque la ventana de Android deje ver
        // detrás, el WebView tapa todo con un rectángulo sólido. Junto con
        // el toggle de body{background:transparent} en AgregarRapido.tsx
        // (el CSS global de la app SÍ pinta fondo opaco, para el resto de
        // pantallas), esto deja ver de verdad la pantalla de inicio detrás.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(android.graphics.Color.TRANSPARENT);
        }
    }
}
