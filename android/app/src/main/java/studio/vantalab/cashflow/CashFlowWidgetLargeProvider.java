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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_cashflow_large);

        SharedPreferences prefs = context.getSharedPreferences(
                CashFlowWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        String balance = prefs.getString(CashFlowWidgetProvider.PREF_BALANCE_TEXT, "$0");
        views.setTextViewText(R.id.widget_balance, balance);

        // Ingresos/egresos del mes — lo "de más" que pidió el usuario,
        // aparte de los movimientos, para que este widget muestre un
        // poco más del panorama completo, no solo la lista.
        views.setTextViewText(R.id.widget_ingresos_mes, prefs.getString(PREF_INGRESOS_MES, "$0"));
        views.setTextViewText(R.id.widget_egresos_mes, prefs.getString(PREF_EGRESOS_MES, "$0"));

        String recientes = prefs.getString(CashFlowWidgetProvider.PREF_RECIENTES, "");
        String[] lineas = recientes.trim().isEmpty() ? new String[0] : recientes.split("\n");
        int[] filaIds = { R.id.widget_reciente_1, R.id.widget_reciente_2, R.id.widget_reciente_3, R.id.widget_reciente_4 };

        for (int i = 0; i < filaIds.length; i++) {
            if (i < lineas.length && !lineas[i].trim().isEmpty()) {
                views.setViewVisibility(filaIds[i], android.view.View.VISIBLE);
                CashFlowWidgetProvider.pintarLineaReciente(views, filaIds[i], lineas[i]);
            } else {
                views.setViewVisibility(filaIds[i], android.view.View.GONE);
            }
        }
        views.setViewVisibility(R.id.widget_reciente_vacio, lineas.length == 0 ? android.view.View.VISIBLE : android.view.View.GONE);

        Intent ingresoIntent = new Intent(context, QuickAddActivity.class);
        ingresoIntent.putExtra("cashflow_widget_action", "ingreso");
        ingresoIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent ingresoPending = PendingIntent.getActivity(
                context, 4, ingresoIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_ingreso, ingresoPending);

        Intent egresoIntent = new Intent(context, QuickAddActivity.class);
        egresoIntent.putExtra("cashflow_widget_action", "egreso");
        egresoIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent egresoPending = PendingIntent.getActivity(
                context, 5, egresoIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_egreso, egresoPending);

        // 🎤 Anotar con voz: VozActivity es invisible, solo muestra la
        // burbuja de dictado encima de la pantalla de inicio (no abre la app).
        Intent vozIntent = new Intent(context, VozActivity.class);
        vozIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent vozPending = PendingIntent.getActivity(
                context, 14, vozIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_btn_voz, vozPending);

        Intent abrirIntent = new Intent(context, MainActivity.class);
        abrirIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent abrirPending = PendingIntent.getActivity(
                context, 6, abrirIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_balance, abrirPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
