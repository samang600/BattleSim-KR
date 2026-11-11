package kr.battlesim.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 앱 화면(웹 코드) 자동 업데이트의 안드로이드와 무관한 부분 — 그래서 PC 의 자바로도 시험할 수 있음 (android/ota-test).
 *
 * 정식 웹(GitHub Pages)의 version.json = {"version":"2.68.0","native":1,"files":[{"p":"index.html","s":크기,"h":"sha256"},…]}
 * - 버전이 지금 쓰는 화면보다 높고, native(화면이 필요로 하는 앱 기능 번호)가 이 앱의 NATIVE_API 이하일 때만 받는다.
 * - 바뀌지 않은 파일(sha256 같음)은 지금 화면에서 복사하고, 바뀐 파일만 내려받는다.
 * - 파일마다 크기·sha256 을 확인한 뒤 임시 폴더를 통째로 <root>/<버전> 으로 옮긴다 (중간에 끊겨도 쓰던 화면은 그대로).
 */
public final class OtaCore {
    private OtaCore() {}

    public static final class Entry { public String p; public long s; public String h; }
    public static final class Manifest {
        public String version = "0"; public int nativeLevel = 0; public List<Entry> files = new ArrayList<>(); public String raw = "";
        public Entry find(String p) { for (Entry e : files) if (e.p.equals(p)) return e; return null; }
    }
    /** 지금 화면의 파일 읽기 (앱 안 assets 또는 받아 둔 폴더) */
    public interface Source { InputStream open(String path) throws IOException; }
    public interface Progress { void on(long done, long total); }

    private static final Pattern VER = Pattern.compile("\"version\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern NAT = Pattern.compile("\"native\"\\s*:\\s*(\\d+)");
    private static final Pattern FILE = Pattern.compile("\\{\\s*\"p\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"s\"\\s*:\\s*(\\d+)\\s*,\\s*\"h\"\\s*:\\s*\"([0-9a-f]{64})\"\\s*\\}");

    /** version.json 읽기 (형식이 이상하면 IOException) */
    public static Manifest parse(String json) throws IOException {
        Manifest m = new Manifest();
        m.raw = json;
        Matcher v = VER.matcher(json); if (!v.find()) throw new IOException("version 없음"); m.version = v.group(1);
        Matcher n = NAT.matcher(json); m.nativeLevel = n.find() ? Integer.parseInt(n.group(1)) : 0;
        Matcher f = FILE.matcher(json);
        while (f.find()) {
            Entry e = new Entry(); e.p = f.group(1); e.s = Long.parseLong(f.group(2)); e.h = f.group(3);
            if (!safePath(e.p)) throw new IOException("이상한 파일 경로: " + e.p);
            m.files.add(e);
        }
        if (m.find("index.html") == null) throw new IOException("index.html 없음");
        return m;
    }

    /** 파일 경로가 폴더 밖으로 나가지 않는지 (../ 나 / 로 시작 금지) */
    static boolean safePath(String p) {
        return !p.isEmpty() && !p.startsWith("/") && !p.contains("..") && !p.contains("\\") && p.matches("[A-Za-z0-9._/-]+");
    }

    /** "2.67.0" 과 "2.68.1" 비교 (숫자 부분끼리) */
    public static int cmpVersion(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }
    private static int num(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9].*$", "")); } catch (Exception e) { return 0; } }

    /** 받을 만한 새 화면인가: 버전이 더 높고, 앱 기능 번호가 맞고, 예전에 실패해 막아 둔 버전이 아님 */
    public static boolean worth(Manifest remote, String currentVersion, int nativeApi, String badVersion) {
        return remote.nativeLevel <= nativeApi && cmpVersion(remote.version, currentVersion) > 0 && !remote.version.equals(badVersion);
    }

    public static String httpGet(String url, int timeoutMs) throws IOException {
        HttpURLConnection c = open(url, timeoutMs);
        try (InputStream in = c.getInputStream()) { return new String(readAll(in), StandardCharsets.UTF_8); }
        finally { c.disconnect(); }
    }
    private static HttpURLConnection open(String url, int timeoutMs) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(timeoutMs); c.setReadTimeout(timeoutMs * 3);
        c.setInstanceFollowRedirects(true);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        int code = c.getResponseCode();
        if (code != 200) { c.disconnect(); throw new IOException("HTTP " + code + " " + url); }
        return c;
    }
    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    public static String sha256(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) { return sha256(in); }
    }
    public static String sha256(InputStream in) throws IOException {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            StringBuilder sb = new StringBuilder();
            for (byte x : md.digest()) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }

    /**
     * 새 화면을 root/<버전> 에 설치하고 그 폴더를 돌려줌.
     * @param base     정식 웹 주소 (끝에 /)
     * @param remote   받은 version.json
     * @param current  지금 화면의 목록 (없으면 null — 모두 내려받음)
     * @param curSrc   지금 화면 파일 읽기 (바뀌지 않은 파일 복사용)
     */
    public static File install(String base, Manifest remote, Manifest current, Source curSrc, File root, Progress progress) throws IOException {
        root.mkdirs();
        File tmp = new File(root, ".tmp-" + remote.version);
        deleteDir(tmp);
        if (!tmp.mkdirs()) throw new IOException("폴더를 만들 수 없음");
        long total = 0, done = 0;
        for (Entry e : remote.files) total += e.s;
        try {
            for (Entry e : remote.files) {
                File out = new File(tmp, e.p);
                if (!out.getCanonicalPath().startsWith(tmp.getCanonicalPath() + File.separator)) throw new IOException("경로 밖: " + e.p);
                out.getParentFile().mkdirs();
                Entry old = current != null ? current.find(e.p) : null;
                boolean copied = false;
                if (old != null && old.h.equals(e.h) && curSrc != null) {   // 안 바뀐 파일: 지금 화면에서 복사
                    try (InputStream in = curSrc.open(e.p)) { copy(in, out); copied = true; } catch (IOException ignore) { copied = false; }
                }
                if (!copied) {
                    HttpURLConnection c = open(base + e.p + "?v=" + remote.version, 20000);
                    final long base0 = done, tot = total;
                    try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(out)) {
                        // 받는 동안에도 진행률을 알림 (화면 파일 하나가 거의 전부라 파일 단위로만 알리면 0% 에서 멈춰 보임)
                        byte[] buf = new byte[65536]; int n; long got = 0;
                        while ((n = in.read(buf)) > 0) { o.write(buf, 0, n); got += n; if (progress != null) progress.on(Math.min(tot, base0 + got), tot); }
                    } finally { c.disconnect(); }
                }
                if (out.length() != e.s) throw new IOException("크기가 다름: " + e.p + " " + out.length() + "≠" + e.s);
                String h = sha256(out);
                if (!h.equals(e.h)) throw new IOException("sha256 다름: " + e.p);
                done += e.s;
                if (progress != null) progress.on(done, total);
            }
            // 확인 끝 → 목록도 같이 넣고 제자리로
            try (OutputStream o = new FileOutputStream(new File(tmp, "version.json"))) { o.write(remote.raw.getBytes(StandardCharsets.UTF_8)); }
            File dst = new File(root, remote.version);
            deleteDir(dst);
            if (!tmp.renameTo(dst)) throw new IOException("옮기기 실패");
            return dst;
        } catch (IOException ex) {
            deleteDir(tmp);
            throw ex;
        }
    }

    /** root 안에서 keep 폴더만 남기고 지움 */
    public static void cleanup(File root, File keep) {
        File[] list = root.listFiles();
        if (list == null) return;
        for (File f : list) if (keep == null || !f.getName().equals(keep.getName())) deleteDir(f);
    }

    static void copy(InputStream in, File out) throws IOException {
        try (OutputStream o = new FileOutputStream(out)) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); }
    }
    public static void deleteDir(File f) {
        if (f == null || !f.exists()) return;
        File[] list = f.listFiles();
        if (list != null) for (File c : list) deleteDir(c);
        f.delete();
    }
}
