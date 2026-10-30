package studio.vantalab.cashflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Widget grande de CashFlow — balance, botones rápidos de Ingreso/Egreso,
 * ingresos/egresos del mes, y hasta 4 movimientos recientes debajo.
 * Comparte la misma fuente de datos (SharedPreferences) que el widget
 * mediano — ver CashFlowWidgetProvider para la explicación de por qué no
 * habla con Supabase directamente.
 *
 * Los movimientos recientes vienen como un solo string con hasta 4 líneas
 * separadas por "\n" (ver CashFlowWidgetPlugin.updateRecientes), cada una
 * con su tipo al frente ("egreso::Mercado · -$45.000") para poder
 * colorearlas — ver CashFlowWidgetProvider.pintarLineaReciente(), que
 * comparten los dos widgets. No es una lista dinámica de verdad
 * (RemoteViewsService/ListView) a propósito: con solo 4 filas fijas, esto es
 * mucho más simple y confiable que una lista de widget de verdad, que tiene
 * fama de comportarse raro con el refresco.
 */
public class CashFlowWidgetLargeProvider extends AppWidgetProvider {

    public static final String PREF_INGRESOS_MES = "ingresos_mes_texto";
    public static final String PREF_EGRESOS_MES = "egresos_mes_texto";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, CashFlowWidgetLargeProvider.class));
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Diseño igual al widget mediano de iPhone: saldo + botones a la
        // izquierda y "Este mes" (ingresos / egresos) a la derecha.
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_cashflow_large);

        SharedPreferences prefs = context.getSharedPreferences(CashFlowWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        // Igual que en iPhone: si la app todavía no ha guardado el saldo,
        // se muestra "Abre CashFlow" en letra más pequeña.
        String balance = prefs.getString(CashFlowWidgetProvider.PREF_BALANCE_TEXT, null);
        if (balance == null || balance.trim().isEmpty()) {
            views.setTextViewText(R.id.widget_balance, "Abre CashFlow");
            views.setTextViewTextSize(R.id.widget_balance, android.util.TypedValue.COMPLEX_UNIT_SP, 15);
        } else {
            views.setTextViewText(R.id.widget_balance, balance);
            views.setTextViewTextSize(R.id.widget_balance, android.util.TypedValue.COMPLEX_UNIT_SP, 26);
        }

        views.setTextViewText(R.id.widget_ingresos_mes, prefs.getString(PREF_INGRESOS_MES, "—"));
        views.setTextViewText(R.id.widget_egresos_mes, prefs.getString(PREF_EGRESOS_MES, "—"));

        // Igual que en iPhone: los botones abren la app completa directo en
        // "Nuevo movimiento" con el tipo elegido, usando el enlace
        // cashflow://nuevo?tipo=… que ya entiende useWidgetLaunch.ts
        // (getLaunchUrl con la app cerrada, appUrlOpen si ya estaba abierta).
        PendingIntent ingresoPending = abrirNuevo(context, "ingreso", 4);
        PendingIntent egresoPending = abrirNuevo(context, "egreso", 5);
        views.setOnClickPendingIntent(R.id.widget_btn_ingreso, ingresoPending);
        views.setOnClickPendingIntent(R.id.widget_btn_egreso, egresoPending);
        // El resto del widget también abre "Nuevo gasto" (como en iPhone).
        views.setOnClickPendingIntent(R.id.widget_root, egresoPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent abrirNuevo(Context context, String tipo, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("cashflow://nuevo?tipo=" + tipo), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
