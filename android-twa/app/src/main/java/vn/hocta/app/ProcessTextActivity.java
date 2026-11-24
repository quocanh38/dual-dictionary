package vn.hocta.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Handles Android's system text selection menu ("Tra với HọcTA" / ACTION_PROCESS_TEXT).
 * Short words/phrases open direct dictionary lookup (?q=...), while longer sentences
 * or paragraphs open directly in the tap-to-lookup Reader (?read=...).
 */
public class ProcessTextActivity extends Activity {
    private static final int MAX_LOOKUP_CHARS = 60;
    private static final int MAX_LOOKUP_WORDS = 5;
    private static final int MAX_READ_CHARS = 1800;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent incoming = getIntent();
        CharSequence raw = null;
        if (incoming != null) {
            raw = incoming.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
            if (raw == null) {
                raw = incoming.getCharSequenceExtra(Intent.EXTRA_TEXT);
            }
        }

        Uri targetUri = buildTargetUri(raw == null ? "" : raw.toString());
        Intent launch = new Intent(Intent.ACTION_VIEW, targetUri, this, LauncherActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(launch);
        finish();
    }

    static Uri buildTargetUri(String rawText) {
        String text = rawText == null ? "" : rawText.trim();
        Uri.Builder builder = new Uri.Builder()
                .scheme("https")
                .authority("hocta.app")
                .path("/index.html");

        if (text.isEmpty()) {
            return builder.fragment("quick").build();
        }

        boolean hasLineBreak = text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0;
        String normalized = text.replaceAll("\\s+", " ");
        int wordCount = normalized.isEmpty() ? 0 : normalized.split(" ").length;

        if (!hasLineBreak && normalized.length() <= MAX_LOOKUP_CHARS && wordCount <= MAX_LOOKUP_WORDS) {
            builder.appendQueryParameter("q", normalized);
        } else {
            String snippet = text.length() > MAX_READ_CHARS ? text.substring(0, MAX_READ_CHARS) : text;
            builder.appendQueryParameter("read", snippet);
        }
        return builder.build();
    }
}
