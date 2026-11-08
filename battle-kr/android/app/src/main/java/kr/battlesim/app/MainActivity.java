package kr.battlesim.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** 한 장짜리 웹앱(assets/www/index.html)을 띄우는 화면 + 오프라인 데이터(그림·울음소리·애니메이션) 내려받기 */
public class MainActivity extends Activity {
    private WebView web;
    private volatile boolean downloading = false;

    // ── 데이터 백업: 시스템의 파일 저장·열기 화면(저장소 접근 프레임워크, 권한 불필요) ──
    private static final int REQ_SAVE = 41, REQ_OPEN = 42, REQ_FILE = 43;
    /** 웹의 파일 고르기(<input type=file>) 결과를 돌려줄 콜백 (포켓몬 그림 바꾸기 등) */
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackup = null;

    private void backupCallback(String fn, String arg) {
        final String js = "window." + fn + " && window." + fn + "(" + org.json.JSONObject.quote(arg) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE) {
            Uri u = data != null ? data.getData() : null;
            if (fileCallback != null) fileCallback.onReceiveValue(resultCode == RESULT_OK && u != null ? new Uri[]{u} : null);
            fileCallback = null;
            return;
        }
        if (requestCode != REQ_SAVE && requestCode != REQ_OPEN) return;
        Uri uri = data != null ? data.getData() : null;
        if (resultCode != RESULT_OK || uri == null) { backupCallback(requestCode == REQ_SAVE ? "__backupSaved" : "__backupLoaded", requestCode == REQ_SAVE ? "cancel" : ""); return; }
        if (requestCode == REQ_SAVE) {
            final String text = pendingBackup; pendingBackup = null;
            new Thread(() -> {
                try (java.io.OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    out.write((text == null ? "" : text).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    backupCallback("__backupSaved", "ok");
                } catch (Exception e) { backupCallback("__backupSaved", "error"); }
            }).start();
        } else {
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
                    byte[] b = new byte[16384]; int n;
                    while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                    backupCallback("__backupLoaded", buf.toString("UTF-8"));
                } catch (Exception e) { backupCallback("__backupLoaded", ""); }
            }).start();
        }
    }

    /** 웹앱에서 쓰는 네이티브 기능 (window.BattleSimNative) */
    public class Native {
        /** 백업 파일 저장: 파일 이름을 고르는 시스템 화면을 띄움 → 결과는 window.__backupSaved('ok'|'cancel'|'error') */
        @JavascriptInterface
        public void saveBackup(String name, String text) {
            pendingBackup = text;
            runOnUiThread(() -> {
                Intent it = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                it.addCategory(Intent.CATEGORY_OPENABLE);
                it.setType("application/json");
                it.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(it, REQ_SAVE); } catch (Exception e) { backupCallback("__backupSaved", "error"); }
            });
        }
        /** 백업 파일 열기 → 내용은 window.__backupLoaded(text) (취소·실패면 빈 문자열) */
        @JavascriptInterface
        public void openBackup() {
            runOnUiThread(() -> {
                Intent it = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                it.addCategory(Intent.CATEGORY_OPENABLE);
                it.setType("*/*");
                try { startActivityForResult(it, REQ_OPEN); } catch (Exception e) { backupCallback("__backupLoaded", ""); }
            });
        }

        /** 오프라인 데이터 상태: {"installed":true,"path":"/data/.../offline","bytes":12345,"parts":"sprites,cries,anims"} */
        @JavascriptInterface
        public String packStatus() {
            File dir = packDir();
            StringBuilder parts = new StringBuilder();
            long bytes = 0;
            for (String p : new String[]{"sprites", "cries", "anims"}) {
                File f = new File(dir, p + "/.done");
                if (f.exists()) { if (parts.length() > 0) parts.append(','); parts.append(p); bytes += dirSize(new File(dir, p)); }
            }
            return "{\"installed\":" + (parts.length() > 0) + ",\"path\":\"" + dir.getAbsolutePath().replace("\\", "\\\\").replace("\"", "\\\"")
                + "\",\"bytes\":" + bytes + ",\"parts\":\"" + parts + "\",\"downloading\":" + downloading + "}";
        }

        /** 묶음 zip 들을 받아 풀어 둔다. spec: "sprites=https://...zip;cries=https://...zip;anims=https://...zip" */
        @JavascriptInterface
        public void downloadPack(String spec) {
            if (downloading) return;
            downloading = true;
            new Thread(() -> {
                try {
                    for (String item : spec.split(";")) {
                        int eq = item.indexOf('=');
                        if (eq < 0) continue;
                        String name = item.substring(0, eq), url = item.substring(eq + 1);
                        File target = new File(packDir(), name);
                        if (new File(target, ".done").exists()) { progress(name, 1, 1, "done"); continue; }
                        deleteDir(target);
                        target.mkdirs();
                        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(20000); c.setReadTimeout(60000);
                        c.setInstanceFollowRedirects(true);
                        long total = c.getContentLengthLong();
                        long got = 0;
                        try (InputStream raw = new BufferedInputStream(c.getInputStream());
                             ZipInputStream zin = new ZipInputStream(new CountingStream(raw, n -> { }))) {
                            ZipEntry e;
                            byte[] buf = new byte[65536];
                            long lastReport = 0;
                            while ((e = zin.getNextEntry()) != null) {
                                File out = new File(target, e.getName());
                                if (!out.getCanonicalPath().startsWith(target.getCanonicalPath())) continue; // zip slip 방지
                                if (e.isDirectory()) { out.mkdirs(); continue; }
                                out.getParentFile().mkdirs();
                                try (FileOutputStream fo = new FileOutputStream(out)) {
                                    int n;
                                    while ((n = zin.read(buf)) > 0) { fo.write(buf, 0, n); got += n; }
                                }
                                if (System.currentTimeMillis() - lastReport > 300) { lastReport = System.currentTimeMillis(); progress(name, got, Math.max(total, got), "downloading"); }
                            }
                        }
                        new File(target, ".done").createNewFile();
                        progress(name, 1, 1, "done");
                    }
                    downloading = false;
                    progress("all", 1, 1, "done");
                } catch (Exception ex) {
                    downloading = false;
                    progress("all", 0, 1, "error:" + ex.getClass().getSimpleName() + " " + String.valueOf(ex.getMessage()).replace("\"", "'"));
                }
            }, "pack-download").start();
        }

        @JavascriptInterface
        public void deletePack() {
            if (downloading) return;
            deleteDir(packDir());
        }
    }

    interface Counter { void add(int n); }
    static class CountingStream extends java.io.FilterInputStream {
        final Counter c;
        CountingStream(InputStream in, Counter c) { super(in); this.c = c; }
        @Override public int read(byte[] b, int off, int len) throws java.io.IOException { int n = super.read(b, off, len); if (n > 0) c.add(n); return n; }
    }

    private File packDir() { return new File(getFilesDir(), "offline"); }

    private static long dirSize(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long s = 0; File[] list = f.listFiles();
        if (list != null) for (File c : list) s += dirSize(c);
        return s;
    }
    private static void deleteDir(File f) {
        if (f == null || !f.exists()) return;
        File[] list = f.listFiles();
        if (list != null) for (File c : list) deleteDir(c);
        f.delete();
    }
    private void progress(String name, long done, long total, String state) {
        final String js = "window.onPackProgress && window.onPackProgress({name:\"" + name + "\",done:" + done + ",total:" + total + ",state:\"" + state.replace("\"", "'") + "\"})";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 게임 중 화면이 꺼지지 않게
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true); // 내려받은 오프라인 데이터(files/offline)를 file:// 로 읽기 위해
        s.setAllowFileAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT); // 포켓몬 그림은 한 번 받으면 캐시에서 사용
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            // 웹의 <input type=file> → 안드로이드 파일 고르기 (기본 WebChromeClient 는 아무것도 열지 않음)
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent it;
                try { it = params.createIntent(); } catch (Exception e) { it = new Intent(Intent.ACTION_GET_CONTENT); it.setType("*/*"); }
                it.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                boolean image = types != null && types.length > 0 && types[0].startsWith("image");
                if (image) it.setType("image/*");
                try { startActivityForResult(it, REQ_FILE); } catch (Exception e) { fileCallback = null; callback.onReceiveValue(null); return false; }
                return true;
            }
        });
        web.setBackgroundColor(0xFF12130F);
        web.addJavascriptInterface(new Native(), "BattleSimNative");
        // 상태 표시줄·내비게이션 바 영역은 앱 밖으로 (안드로이드 15 의 화면 끝까지 그리기 대응)
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF1C1D19);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.onAndroidPause && window.onAndroidPause()", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.onAndroidResume && window.onAndroidResume()", null);
    }

    @Override
    public void onBackPressed() {
        // 앱 안의 뒤로가기(모달 닫기·이전 화면)를 먼저 시도
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'y' : 'n'", v -> {
            if (v == null || !v.contains("y")) MainActivity.super.onBackPressed();
        });
    }
}
