package studio.vantalab.cashflow;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CashFlowWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Sin esto, si la app ya estaba abierta en segundo plano, tocar un
        // botón del widget no se notaría — getIntent() seguiría devolviendo
        // el intent viejo con el que se abrió la app la primera vez.
        setIntent(intent);
    }
}
