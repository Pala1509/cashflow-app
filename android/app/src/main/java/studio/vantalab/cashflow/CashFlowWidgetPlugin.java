package studio.vantalab.cashflow;

import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente entre la app en React y los widgets de la pantalla de inicio.
 *
 * - updateBalance: la app llama esto cada vez que recalcula el balance total
 *   (en useFinanzas.ts), para que los widgets muestren un número actualizado
 *   sin esperar a que Android decida refrescarlos solos.
 * - updateRecientes: igual, pero con los últimos movimientos ya formateados
 *   como texto — para el widget grande. Vienen listos desde React (nombre +
 *   monto ya con signo y formato de moneda) porque el widget no tiene forma
 *   de calcular nada por su cuenta, solo pinta strings.
 * - getLaunchAction: al abrir la app (o la ventanita rápida), React pregunta
 *   "¿me abriste desde un botón del widget?" para saber si debe ir directo
 *   a agregar un ingreso o egreso, en vez de la pantalla normal.
 * - cerrarVentanaRapida: solo tiene sentido llamado desde QuickAddActivity —
 *   cierra esa ventanita apenas se guarda el movimiento, sin pasar por
 *   ninguna navegación de la app completa.
 */
@CapacitorPlugin(name = "CashFlowWidget")
public class CashFlowWidgetPlugin extends Plugin {

    @PluginMethod
    public void updateBalance(PluginCall call) {
        String balanceText = call.getString("balanceText", "$0");

        SharedPreferences prefs = getContext().getSharedPreferences(
                CashFlowWidgetProvider.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit().putString(CashFlowWidgetProvider.PREF_BALANCE_TEXT, balanceText).apply();

        CashFlowWidgetProvider.updateAllWidgets(getContext());
        CashFlowWidgetLargeProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    @PluginMethod
    public void updateRecientes(PluginCall call) {
        // Hasta 4 líneas ya armadas del lado de React ("egreso::Mercado ·
        // -$45.000"), separadas por "\n" — cada una con su tipo al frente
        // (antes de "::") para que el widget las pueda colorear (verde
        // ingreso, coral egreso, lavanda transferencia) sin saber nada de
        // transacciones ni de formato de moneda.
        String lineas = call.getString("lineas", "");

        SharedPreferences prefs = getContext().getSharedPreferences(
                CashFlowWidgetProvider.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit().putString(CashFlowWidgetProvider.PREF_RECIENTES, lineas).apply();

        CashFlowWidgetProvider.updateAllWidgets(getContext());
        CashFlowWidgetLargeProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    @PluginMethod
    public void updateResumenMes(PluginCall call) {
        String ingresos = call.getString("ingresos", "$0");
        String egresos = call.getString("egresos", "$0");

        SharedPreferences prefs = getContext().getSharedPreferences(
                CashFlowWidgetProvider.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        prefs.edit()
                .putString(CashFlowWidgetLargeProvider.PREF_INGRESOS_MES, ingresos)
                .putString(CashFlowWidgetLargeProvider.PREF_EGRESOS_MES, egresos)
                .apply();

        CashFlowWidgetLargeProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getLaunchAction(PluginCall call) {
        String action = "none";
        if (getActivity() != null && getActivity().getIntent() != null) {
            String extra = getActivity().getIntent().getStringExtra("cashflow_widget_action");
            if (extra != null) action = extra;
            // La consumimos una sola vez, para que no se repita si el
            // usuario navega de un lado a otro dentro de la app después.
            getActivity().getIntent().removeExtra("cashflow_widget_action");
        }
        JSObject ret = new JSObject();
        ret.put("action", action);
        call.resolve(ret);
    }

    @PluginMethod
    public void cerrarVentanaRapida(PluginCall call) {
        if (getActivity() != null) {
            getActivity().finish();
        }
        call.resolve();
    }
}
