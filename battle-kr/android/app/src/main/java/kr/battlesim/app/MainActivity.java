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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.content.SharedPreferences;

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

    // ── 앱 화면 자동 업데이트 (OtaCore) ──
    // 화면은 늘 file:///android_asset/www/… 주소로 열고(저장 데이터 localStorage 가 그대로 이어지게), 받아 둔 새 화면이 있으면
    // 같은 주소의 요청에 그 파일을 대신 내어 줌. 새 화면이 두 번 연속 제대로 안 뜨면(bootOk 가 안 옴) 앱 안 화면으로 되돌림.
    /** 이 앱이 가진 네이티브 기능 번호 — 화면(build.mjs 의 OTA_NATIVE)이 이보다 높은 번호를 요구하면 받지 않음 */
    static final int NATIVE_API = 1;
    static final String OTA_BASE = "https://samang600.github.io/BattleSim-KR/";
    static final String ASSET_PREFIX = "file:///android_asset/www/";
    private volatile File otaActive = null;          // 지금 쓰는 받아 둔 화면 폴더 (null = 앱 안 화면)
    private volatile String activeVersion = "0";
    private OtaCore.Manifest assetManifest = null;
    private volatile File otaReady = null;            // 받아 두었고 다시 시작하면 쓸 화면
    private volatile boolean otaChecking = false;
    private long otaLastCheck = 0;
    private SharedPreferences prefs() { return getSharedPreferences("ota", MODE_PRIVATE); }
    private File otaRoot() { return new File(getFilesDir(), "ota"); }

    /** 시작할 때 어떤 화면을 쓸지: 받아 둔 화면이 앱 안 화면보다 새것이고, 최근에 시작 실패가 없을 때만 */
    private void chooseBundle() {
        try (InputStream in = getAssets().open("www/version.json")) {
            assetManifest = OtaCore.parse(new String(readAllBytes(in), java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) { assetManifest = null; }
        String assetVer = assetManifest != null ? assetManifest.version : "0";
        activeVersion = assetVer; otaActive = null;
        SharedPreferences p = prefs();
        String v = p.getString("version", null);
        File dir = v != null ? new File(otaRoot(), v) : null;
        if (dir == null || !new File(dir, "index.html").exists() || OtaCore.cmpVersion(v, assetVer) <= 0) {
            // 없거나 앱(APK)이 더 새것 → 받아 둔 화면은 지움
            if (v != null) p.edit().remove("version").putInt("boot", 0).apply();
            OtaCore.deleteDir(otaRoot());
            return;
        }
        int boot = p.getInt("boot", 0);
        if (boot >= 2) {   // 두 번 연속 제대로 안 떴음 → 이 버전은 막고 앱 안 화면으로
            p.edit().remove("version").putInt("boot", 0).putString("bad", v).apply();
            OtaCore.deleteDir(otaRoot());
            return;
        }
        p.edit().putInt("boot", boot + 1).apply();   // 화면이 bootOk() 를 부르면 0 으로
        otaActive = dir; activeVersion = v;
        OtaCore.cleanup(otaRoot(), dir);   // 예전에 받은 다른 버전·남은 임시 폴더 정리
    }

    private static byte[] readAllBytes(InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    /** 정식 웹에 새 화면이 있는지 보고, 있으면 받아서 확인해 둠 → 화면에 window.onOtaReady({version}) */
    private void checkOta(boolean force) {
        if (otaChecking || otaReady != null) return;
        long now = System.currentTimeMillis();
        if (!force && now - otaLastCheck < 6 * 3600 * 1000L) return;
        otaLastCheck = now;
        otaChecking = true;
        new Thread(() -> {
            try {
                OtaCore.Manifest remote = OtaCore.parse(OtaCore.httpGet(OTA_BASE + "version.json?t=" + System.currentTimeMillis(), 15000));
                if (!OtaCore.worth(remote, activeVersion, NATIVE_API, prefs().getString("bad", ""))) { otaChecked("none:" + remote.version); return; }
                final File cur = otaActive;
                OtaCore.Manifest curM = cur == null ? assetManifest : OtaCore.parse(new String(readAllBytes(new java.io.FileInputStream(new File(cur, "version.json"))), java.nio.charset.StandardCharsets.UTF_8));
                OtaCore.Source src = cur == null ? path -> getAssets().open("www/" + path) : path -> new java.io.FileInputStream(new File(cur, path));
                File dir = OtaCore.install(OTA_BASE, remote, curM, src, otaRoot(), null);
                prefs().edit().putString("version", remote.version).putInt("boot", 0).apply();   // 다음 시작부터 이 화면
                otaReady = dir;
                final String js = "window.onOtaReady && window.onOtaReady({version:" + org.json.JSONObject.quote(remote.version) + "})";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
                otaChecked("ready:" + remote.version);
            } catch (Exception e) {
                android.util.Log.w("BattleSimOTA", "update check failed: " + e);
                otaChecked("error:" + e.getMessage());
            } finally { otaChecking = false; }
        }, "ota-check").start();
    }

    /** 확인 결과를 화면에: window.onOtaChecked('none:2.67.0' | 'ready:2.68.0' | 'error:…') (설정의 '업데이트 확인'용) */
    private void otaChecked(String r) {
        final String js = "window.onOtaChecked && window.onOtaChecked(" + org.json.JSONObject.quote(String.valueOf(r)) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".css")) return "text/css";
        return "application/octet-stream";
    }

    // ── 데이터 백업: 시스템의 파일 저장·열기 화면(저장소 접근 프레임워크, 권한 불필요) ──
    private static final int REQ_SAVE = 41, REQ_OPEN = 42, REQ_FILE = 43, REQ_SAVEFILE = 44;
    /** saveFile 로 저장할 바이트 (저장 위치를 고르는 동안 보관) */
    private byte[] pendingFile;
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
            Uri[] res = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {   // 여러 장 고름
                    android.content.ClipData cd = data.getClipData();
                    res = new Uri[cd.getItemCount()];
                    for (int i = 0; i < res.length; i++) res[i] = cd.getItemAt(i).getUri();
                } else if (data.getData() != null) res = new Uri[]{data.getData()};
            }
            if (fileCallback != null) fileCallback.onReceiveValue(res);
            fileCallback = null;
            return;
        }
        if (requestCode == REQ_SAVEFILE) {
            Uri u = data != null ? data.getData() : null;
            final byte[] bytes = pendingFile; pendingFile = null;
            if (resultCode != RESULT_OK || u == null) { backupCallback("__fileSaved", "cancel"); return; }
            new Thread(() -> {
                try (java.io.OutputStream out = getContentResolver().openOutputStream(u, "wt")) { out.write(bytes); backupCallback("__fileSaved", "ok"); }
                catch (Exception e) { backupCallback("__fileSaved", "error"); }
            }).start();
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
        /** 파일 저장 (zip 등 바이너리, base64): 저장 위치를 고르게 하고 결과는 window.__fileSaved('ok'|'cancel'|'error') */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            try { pendingFile = android.util.Base64.decode(base64, android.util.Base64.DEFAULT); } catch (Exception e) { backupCallback("__fileSaved", "error"); return; }
            runOnUiThread(() -> {
                Intent it = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                it.addCategory(Intent.CATEGORY_OPENABLE);
                it.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                it.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(it, REQ_SAVEFILE); } catch (Exception e) { pendingFile = null; backupCallback("__fileSaved", "error"); }
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

        /** 화면이 제대로 떴다고 알림 (받아 둔 새 화면이 시작에 실패하면 되돌리는 데 씀) */
        @JavascriptInterface
        public void bootOk() { prefs().edit().putInt("boot", 0).apply(); }

        /** 받아 둔 새 화면으로 다시 시작 */
        @JavascriptInterface
        public void restartApp() {
            runOnUiThread(() -> {
                chooseBundle();
                otaReady = null;
                web.loadUrl(ASSET_PREFIX + "index.html");
            });
        }

        /** 화면 버전 정보: {"version":"2.68.0","source":"ota"|"app","apk":"2.67.0","ready":"2.69.0"|null,"native":1} */
        @JavascriptInterface
        public String otaStatus() {
            File r = otaReady;
            return "{\"version\":" + org.json.JSONObject.quote(activeVersion) + ",\"source\":\"" + (otaActive != null ? "ota" : "app") + "\",\"apk\":"
                + org.json.JSONObject.quote(assetManifest != null ? assetManifest.version : "") + ",\"ready\":" + (r != null ? org.json.JSONObject.quote(r.getName()) : "null") + ",\"native\":" + NATIVE_API + "}";
        }

        /** 지금 새 화면이 있는지 바로 확인 (설정 화면의 '업데이트 확인') */
        @JavascriptInterface
        public void checkUpdate() { if (otaReady != null) otaChecked("ready:" + otaReady.getName()); else checkOta(true); }

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
        chooseBundle();
        web.setWebViewClient(new WebViewClient() {
            // 받아 둔 새 화면이 있으면 같은 주소(file:///android_asset/www/…)의 요청에 그 파일을 내어 줌
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                File dir = otaActive;
                if (dir == null) return null;
                try {
                    String url = req.getUrl().toString();
                    if (!url.startsWith(ASSET_PREFIX)) return null;
                    String path = url.substring(ASSET_PREFIX.length());
                    int q = path.indexOf('?'); if (q >= 0) path = path.substring(0, q);
                    int h = path.indexOf('#'); if (h >= 0) path = path.substring(0, h);
                    if (path.isEmpty()) path = "index.html";
                    File f = new File(dir, path);
                    if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator) || !f.isFile()) return null;
                    String mime = mimeOf(path);
                    return new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("javascript") ? "UTF-8" : null, new java.io.FileInputStream(f));
                } catch (Exception e) { return null; }   // 문제가 있으면 앱 안 파일로
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                checkOta(false);
            }
        });
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
                boolean image = types != null && types.length == 1 && types[0].startsWith("image");
                if (image) it.setType("image/*");
                else if (types != null && types.length > 1) { it.setType("*/*"); it.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/zip", "image/*"}); }
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) it.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
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
        checkOta(false);   // 오래 켜 둔 경우 (6시간마다)
    }

    @Override
    public void onBackPressed() {
        // 앱 안의 뒤로가기(모달 닫기·이전 화면)를 먼저 시도
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'y' : 'n'", v -> {
            if (v == null || !v.contains("y")) MainActivity.super.onBackPressed();
        });
    }
}
