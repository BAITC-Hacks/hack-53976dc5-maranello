package kz.aisana.practice;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME = "https://ai-sana-practice.ramirr2006.chatgpt.site/";
    private static final String HOST = "ai-sana-practice.ramirr2006.chatgpt.site";
    private WebView web;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private boolean failed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(245,247,242));
        // Keep the web UI and toolbar away from status/navigation bars on Android 15.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8),dp(4),dp(8),dp(4));
        bar.setBackgroundColor(Color.rgb(33,75,55));
        ImageButton back = toolbarButton(android.R.drawable.ic_media_previous, "Назад");
        back.setOnClickListener(v -> onBackPressed());
        bar.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView title = new TextView(this);
        title.setText("AI Sana");title.setTextSize(20);title.setTextColor(Color.WHITE);
        bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));title.setGravity(Gravity.CENTER_VERTICAL);
        ImageButton reload = toolbarButton(android.R.drawable.ic_popup_sync, "Обновить страницу");
        reload.setOnClickListener(v -> web.reload());
        bar.addView(reload,new LinearLayout.LayoutParams(dp(48),dp(48)));
        ImageButton share = toolbarButton(android.R.drawable.ic_menu_view, "Открыть в браузере");
        share.setOnClickListener(v -> openExternal(Uri.parse(web.getUrl() == null ? HOME : web.getUrl())));
        bar.addView(share,new LinearLayout.LayoutParams(dp(48),dp(48)));
        root.addView(bar);
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(33,75,55)));
        root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        errorPanel = new LinearLayout(this);errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);errorPanel.setPadding(dp(24),dp(24),dp(24),dp(24));
        TextView error = new TextView(this);
        error.setText("Не удалось открыть AI Sana\n\nПроверьте подключение к интернету и попробуйте снова.");
        error.setTextSize(18);error.setTextColor(Color.rgb(21,61,45));error.setGravity(Gravity.CENTER);
        errorPanel.addView(error);
        Button retry = new Button(this);retry.setText("Повторить");retry.setOnClickListener(v -> web.reload());errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);root.addView(errorPanel,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
                Uri uri=request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) {
                    if (uri.getPath()!=null && uri.getPath().startsWith("/signin-with-chatgpt")) {
                        Toast.makeText(MainActivity.this,"Для входа внутри приложения используйте business или student",Toast.LENGTH_LONG).show();
                        openExternal(uri);return true;
                    }
                    return false;
                }
                if (request.isForMainFrame()) openExternal(uri);
                return true;
            }
            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){failed=false;errorPanel.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);}
            @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();if(failed)showError();}
            @Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame()){failed=true;showError();}}
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame() && response.getStatusCode()>=500){failed=true;showError();}}
        });
        setContentView(root);
        if(state==null || web.restoreState(state)==null)web.loadUrl(HOME);
    }
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private ImageButton toolbarButton(int icon,String description){ImageButton b=new ImageButton(this);b.setImageResource(icon);b.setColorFilter(Color.WHITE);b.setBackgroundColor(Color.TRANSPARENT);b.setContentDescription(description);b.setPadding(dp(12),dp(12),dp(12),dp(12));return b;}
    private void showError(){progress.setVisibility(View.GONE);web.setVisibility(View.GONE);errorPanel.setVisibility(View.VISIBLE);}
    private void openExternal(Uri uri){String scheme=uri.getScheme();if(!"https".equals(scheme)&&!"mailto".equals(scheme))return;try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){Toast.makeText(this,"Нет приложения для этой ссылки",Toast.LENGTH_SHORT).show();}}
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override public void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
    @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();CookieManager.getInstance().flush();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
