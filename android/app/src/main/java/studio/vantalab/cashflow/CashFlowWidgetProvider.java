package studio.vantalab.cashflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Widget de CashFlow para la pantalla de inicio de Android.
 *
 * No habla con Supabase directamente — sería duplicar la sesión/autenticación
 * fuera de la WebView, mucho más frágil. En cambio, lee el último balance que
 * la propia app (JavaScript) ya guardó en SharedPreferences cada vez que
 * calculó los totales (ver CashFlowWidgetPlugin.java). El widget solo pinta
 * ese último valor conocido, y Android lo refresca solo cada ~30 minutos
 * (el mínimo que el sistema permite) además de cuando la app lo empuja.
 */
public class CashFlowWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "studio.vantalab.cashflow.widget";
    public static final String PREF_BALANCE_TEXT = "balance_text";
    // Compartida con el widget grande — ver CashFlowWidgetLargeProvider.
    // Cada línea trae su tipo al frente ("egreso::Mercado · -$45.000")
    // para poder colorear ingreso/egreso/transferencia distinto.
    public static final String PREF_RECIENTES = "recientes_texto";

    // Mismos colores exactos que usa la app en modo oscuro (ver
    // src/index.css) — para que un movimiento se vea igual de "verde" o
    // "coral" acá que dentro de la app.
    private static final int COLOR_INGRESO = android.graphics.Color.parseColor("#C6FF4D");
    private static final int COLOR_EGRESO = android.graphics.Color.parseColor("#FF7A6E");
    private static final int COLOR_TRANSFERENCIA = android.graphics.Color.parseColor("#B9A6F5");
    private static final int COLOR_NEUTRO = android.graphics.Color.parseColor("#D8D8D6");

    // Pinta una fila de "movimientos recientes" — recibe la línea cruda tal
    // cual la mandó React ("egreso::Mercado · -$45.000"), la separa en tipo
    // + texto, y le pone el color que corresponda. La usan tanto este
    // widget como CashFlowWidgetLargeProvider, para que las dos versiones
    // se vean exactamente igual de coloreadas.
    static void pintarLineaReciente(RemoteViews views, int viewId, String lineaCruda) {
        String tipo = "";
        String texto = lineaCruda;
        int sep = lineaCruda.indexOf("::");
        if (sep >= 0) {
            tipo = lineaCruda.substring(0, sep);
            texto = lineaCruda.substring(sep + 2);
        }
        views.setTextViewText(viewId, texto);
        int color;
        if ("ingreso".equals(tipo)) color = COLOR_INGRESO;
        else if ("egreso".equals(tipo)) color = COLOR_EGRESO;
        else if ("transferencia".equals(tipo)) color = COLOR_TRANSFERENCIA;
        else color = COLOR_NEUTRO;
        views.setTextColor(viewId, color);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, CashFlowWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_cashflow);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String balance = prefs.getString(PREF_BALANCE_TEXT, "$0");
        views.setTextViewText(R.id.widget_balance, balance);

        // Hasta 3 movimientos recientes (uno menos que el widget grande —
        // acá el espacio es más chico). Mismo helper de arriba para el
        // color de cada uno.
        String recientes = prefs.getString(PREF_RECIENTES, "");
        String[] lineas = recientes.trim().isEmpty() ? new String[0] : recientes.split("\n");
        int[] filaIds = { R.id.widget_reciente_1, R.id.widget_reciente_2, R.id.widget_reciente_3 };
        for (int i = 0; i < filaIds.length; i++) {
            if (i < lineas.length && !lineas[i].trim().isEmpty()) {
                views.setViewVisibility(filaIds[i], android.view.View.VISIBLE);
                pintarLineaReciente(views, filaIds[i], lineas[i]);
            } else {
                views.setViewVisibility(filaIds[i], android.view.View.GONE);
            }
        }
        views.setViewVisibility(R.id.widget_reciente_vacio, lineas.length == 0 ? android.view.View.VISIBLE : android.view.View.GONE);

        // Tocar "+ Ingreso" o "- Egreso" abre la ventanita flotante de
        // agregar rápido (QuickAddActivity), NO la app completa — antes
        // abría MainActivity y navegaba hasta /movimiento/nuevo, que
        // seguía siendo varios toques y pantallas hasta guardar.
        Intent ingresoIntent = new Intent(context, QuickAddActivity.class);
        ingresoIntent.putExtra("cashflow_widget_action", "ingreso");
        ingresoIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent ingresoPending = PendingIntent.getActivity(
                context, 1, ingresoIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_ingreso, ingresoPending);

        Intent egresoIntent = new Intent(context, QuickAddActivity.class);
        egresoIntent.putExtra("cashflow_widget_action", "egreso");
        egresoIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent egresoPending = PendingIntent.getActivity(
                context, 2, egresoIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_egreso, egresoPending);

        // 🎤 Anotar con voz: VozActivity es invisible, solo muestra la
        // burbuja de dictado encima de la pantalla de inicio (no abre la app).
        Intent vozIntent = new Intent(context, VozActivity.class);
        vozIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent vozPending = PendingIntent.getActivity(
                context, 4, vozIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_voz, vozPending);

        // Tocar el resto del widget (la marca/balance) simplemente abre la app normal.
        Intent abrirIntent = new Intent(context, MainActivity.class);
        abrirIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent abrirPending = PendingIntent.getActivity(
                context, 3, abrirIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_balance, abrirPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
