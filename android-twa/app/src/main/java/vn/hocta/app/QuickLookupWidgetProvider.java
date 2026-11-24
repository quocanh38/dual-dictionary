package vn.hocta.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * Home screen quick-lookup widget for HọcTA:
 * - Search bar tap -> opens quick lookup (#quick)
 * - Quick action buttons -> Reader (#/reader), FSRS Review (#/review), Exam Lab (#/practice)
 */
public class QuickLookupWidgetProvider extends AppWidgetProvider {

    private static final String URL_QUICK_SEARCH = "https://hocta.app/index.html#quick";
    private static final String URL_READER = "https://hocta.app/index.html#/reader";
    private static final String URL_REVIEW = "https://hocta.app/index.html#/review";
    private static final String URL_PRACTICE = "https://hocta.app/index.html#/practice";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_lookup);

        views.setOnClickPendingIntent(
                R.id.widget_search_bar,
                createLaunchPendingIntent(context, URL_QUICK_SEARCH, 1001)
        );
        views.setOnClickPendingIntent(
                R.id.widget_btn_reader,
                createLaunchPendingIntent(context, URL_READER, 1002)
        );
        views.setOnClickPendingIntent(
                R.id.widget_btn_review,
                createLaunchPendingIntent(context, URL_REVIEW, 1003)
        );
        views.setOnClickPendingIntent(
                R.id.widget_btn_practice,
                createLaunchPendingIntent(context, URL_PRACTICE, 1004)
        );

        manager.updateAppWidget(widgetId, views);
    }

    private static PendingIntent createLaunchPendingIntent(Context context, String url, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url), context, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
