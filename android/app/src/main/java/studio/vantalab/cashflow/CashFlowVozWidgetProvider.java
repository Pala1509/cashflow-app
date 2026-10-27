package studio.vantalab.cashflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Widget pequeño (1x1) de CashFlow: solo un micrófono. Tocarlo abre
 * VozActivity — la burbuja de dictado encima de la pantalla de inicio —
 * para anotar un movimiento con la voz sin abrir la app.
 */
public class CashFlowVozWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_voz);
            Intent vozIntent = new Intent(context, VozActivity.class);
            vozIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent pending = PendingIntent.getActivity(
                    context, 30, vozIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_voz_btn, pending);
            views.setOnClickPendingIntent(R.id.widget_voz_root, pending);
            appWidgetManager.updateAppWidget(id, views);
        }
    }
}
