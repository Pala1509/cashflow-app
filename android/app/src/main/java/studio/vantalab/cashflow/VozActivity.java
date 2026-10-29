package studio.vantalab.cashflow;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Anotar con voz" en Android — el equivalente a Siri (ver
 * ios/App/App/CashFlowSiri.swift).
 *
 * Es una Activity invisible (tema translúcido, sin layout): no abre la app
 * ni la WebView. Solo muestra la burbuja de dictado de Google encima de lo
 * que estés viendo (pantalla de inicio), manda la frase a la Edge Function
 * `siri-movimiento` (la misma de Siri, entiende exactamente igual), y si el
 * servidor pregunta "¿Cómo pagaste?" vuelve a abrir la burbuja con esa
 * pregunta. Al guardar: notificación con el resumen + Toast, y se cierra.
 *
 * Se abre desde: el botón 🎤 de los widgets, el widget pequeño de voz y el
 * acceso directo al mantener presionado el ícono de CashFlow.
 *
 * Extra opcional "tipo": "egreso" | "ingreso" (si no viene, lo deduce el
 * servidor de la frase).
 *
 * Auth: token propio que la app guarda con @capacitor/preferences →
 * SharedPreferences "CapacitorStorage", llave "siri_token" (se genera solo
 * al abrir la app con sesión, ver src/lib/siri.ts).
 */
public class VozActivity extends Activity {

    public static final String EXTRA_TIPO = "tipo";

    private static final String URL_FUNCION = "https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/siri-movimiento";
    private static final String PREFS_CAPACITOR = "CapacitorStorage";
    private static final String LLAVE_TOKEN = "siri_token";
    private static final String CANAL = "cashflow_voz";

    private static final int REQ_FRASE = 1;
    private static final int REQ_METODO = 2;
    private static final int MAX_PREGUNTAS_CUENTA = 3;

    private final ExecutorService red = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());

    private String tipo;          // "egreso" | "ingreso" | null
    private String frase;         // lo que dijo primero
    private int preguntasCuenta = 0;
    private boolean enCurso = false;

    // Voz de la app: lee en voz alta la pregunta ("¿Cómo pagaste?") antes
    // de abrir el dictado, como hace Siri. Si el motor de voz no está listo
    // o falla, se abre el dictado igual, sin esperar.
    private TextToSpeech tts;
    private boolean ttsListo = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        tipo = getIntent().getStringExtra(EXTRA_TIPO);
        if (savedInstanceState != null) {
            frase = savedInstanceState.getString("frase");
            preguntasCuenta = savedInstanceState.getInt("preguntasCuenta", 0);
            enCurso = savedInstanceState.getBoolean("enCurso", false);
            if (enCurso) return; // el resultado del dictado llega por onActivityResult
        }

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("es", "CO"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = tts.setLanguage(new Locale("es"));
                ttsListo = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });

        if (token() == null) {
            avisarYCerrar("Abre CashFlow una vez con tu cuenta para activar la voz.");
            return;
        }
        String pregunta = "ingreso".equals(tipo) ? "¿Qué ingreso anoto?"
                : "egreso".equals(tipo) ? "¿Qué gasto anoto?"
                : "¿Qué movimiento anoto?";
        escuchar(REQ_FRASE, pregunta);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("frase", frase);
        out.putInt("preguntasCuenta", preguntasCuenta);
        out.putBoolean("enCurso", enCurso);
    }

    private String token() {
        SharedPreferences p = getSharedPreferences(PREFS_CAPACITOR, Context.MODE_PRIVATE);
        String t = p.getString(LLAVE_TOKEN, null);
        return (t == null || t.trim().isEmpty()) ? null : t.trim();
    }

    private void hablarYEscuchar(final int requestCode, final String pregunta) {
        if (tts == null || !ttsListo) { escuchar(requestCode, pregunta); return; }
        final boolean[] yaAbrio = { false };
        final Runnable abrir = () -> {
            if (yaAbrio[0] || isFinishing()) return;
            yaAbrio[0] = true;
            escuchar(requestCode, pregunta);
        };
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { ui.post(abrir); }
            @Override public void onError(String id) { ui.post(abrir); }
        });
        int r = tts.speak(pregunta, TextToSpeech.QUEUE_FLUSH, null, "pregunta");
        if (r != TextToSpeech.SUCCESS) { abrir.run(); return; }
        // Red de seguridad: si el motor nunca avisa que terminó, abrir igual.
        ui.postDelayed(abrir, 4000);
    }

    private void escuchar(int requestCode, String pregunta) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-CO");
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-CO");
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, pregunta);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            enCurso = true;
            startActivityForResult(i, requestCode);
        } catch (ActivityNotFoundException e) {
            enCurso = false;
            avisarYCerrar("Este celular no tiene dictado por voz. Instala o activa la app de Google.");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        enCurso = false;
        if (resultCode != RESULT_OK || data == null) { finish(); return; } // canceló o no habló
        ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        String dicho = (r == null || r.isEmpty()) ? "" : r.get(0).trim();
        if (dicho.isEmpty()) { finish(); return; }

        if (requestCode == REQ_FRASE) {
            frase = dicho;
            enviar(null);
        } else if (requestCode == REQ_METODO) {
            enviar(dicho);
        }
    }

    private void enviar(final String metodo) {
        final String tok = token();
        red.execute(() -> {
            JSONObject resp;
            try {
                JSONObject body = new JSONObject();
                body.put("frase", frase);
                body.put("preguntarCuenta", true);
                if (tipo != null) body.put("tipo", tipo);
                if (metodo != null) body.put("metodo", metodo);
                resp = post(body, tok);
            } catch (Exception e) {
                ui.post(() -> avisarYCerrar("No hay conexión para anotarlo. Intenta de nuevo en un momento."));
                return;
            }
            final JSONObject res = resp;
            ui.post(() -> manejarRespuesta(res));
        });
    }

    private void manejarRespuesta(JSONObject res) {
        if (res.optBoolean("necesitaCuenta", false)) {
            preguntasCuenta++;
            if (preguntasCuenta > MAX_PREGUNTAS_CUENTA) {
                avisarYCerrar("No reconocí la cuenta. No guardé nada; intenta de nuevo.");
                return;
            }
            hablarYEscuchar(REQ_METODO, res.optString("pregunta", "¿Cómo pagaste?"));
            return;
        }
        if (!res.optBoolean("ok", false)) {
            avisarYCerrar(res.optString("mensaje", "No pude anotar el movimiento."));
            return;
        }
        JSONObject n = res.optJSONObject("notificacion");
        String titulo = n != null ? n.optString("titulo", "Movimiento anotado") : "Movimiento anotado";
        String cuerpo = n != null ? n.optString("cuerpo", "") : res.optString("mensaje", "");
        notificar(titulo, cuerpo);
        Toast.makeText(getApplicationContext(), "✓ " + titulo, Toast.LENGTH_SHORT).show();
        finish();
    }

    private JSONObject post(JSONObject body, String tok) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(URL_FUNCION).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("x-siri-token", tok == null ? "" : tok);
        try (OutputStream os = c.getOutputStream()) {
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        int code = c.getResponseCode();
        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
        StringBuilder sb = new StringBuilder();
        if (is != null) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
            }
        }
        c.disconnect();
        return sb.length() > 0 ? new JSONObject(sb.toString()) : new JSONObject();
    }

    private void notificar(String titulo, String cuerpo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CANAL) == null) {
                nm.createNotificationChannel(new NotificationChannel(CANAL, "Anotar con voz", NotificationManager.IMPORTANCE_DEFAULT));
            }
        }
        Intent abrir = new Intent(this, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pi = android.app.PendingIntent.getActivity(this, 40, abrir,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_cashflow)
                .setContentTitle(titulo)
                .setContentText(cuerpo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
                .setContentIntent(pi)
                .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(this).notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), b.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones: queda el Toast como confirmación.
        }
    }

    private void avisarYCerrar(String texto) {
        Toast.makeText(getApplicationContext(), texto, Toast.LENGTH_LONG).show();
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        red.shutdown();
        if (tts != null) { tts.stop(); tts.shutdown(); }
    }
}
