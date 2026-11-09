import kr.battlesim.app.OtaCore;
import java.io.*;
import java.nio.file.*;

/** OtaCore 시험 (PC 자바): ota-test/run.sh 가 dist 로 '지금 화면'·'새 화면'을 만들고 로컬 서버를 띄운 뒤 실행 */
public class OtaTest {
    static int fail = 0;
    static void ok(boolean c, String msg) { System.out.println((c ? "  통과 " : "  실패 ") + msg); if (!c) fail++; }
    public static void main(String[] a) throws Exception {
        File cur = new File(a[0]), root = new File(a[1]); String base = a[2], badBase = a[3];
        OtaCore.Manifest curM = OtaCore.parse(new String(Files.readAllBytes(new File(cur, "version.json").toPath()), "UTF-8"));
        OtaCore.Source src = p -> new FileInputStream(new File(cur, p));

        System.out.println("1) 버전 비교");
        ok(OtaCore.cmpVersion("2.68.0", "2.67.0") > 0 && OtaCore.cmpVersion("2.67.0", "2.67.0") == 0 && OtaCore.cmpVersion("2.9.0", "2.10.0") < 0 && OtaCore.cmpVersion("3.0", "2.99.9") > 0, "2.68.0>2.67.0, 같음, 2.9<2.10, 3.0>2.99.9");

        System.out.println("2) 새 화면 받기");
        OtaCore.Manifest rem = OtaCore.parse(OtaCore.httpGet(base + "version.json", 5000));
        ok(OtaCore.worth(rem, curM.version, 1, ""), "받을 만함 (" + rem.version + " > " + curM.version + ")");
        ok(!OtaCore.worth(rem, curM.version, 0, ""), "앱 기능 번호가 낮으면 안 받음");
        ok(!OtaCore.worth(rem, curM.version, 1, rem.version), "실패해 막아 둔 버전이면 안 받음");
        ok(!OtaCore.worth(rem, rem.version, 1, ""), "이미 같은 버전이면 안 받음");
        File dir = OtaCore.install(base, rem, curM, src, root, null);
        boolean same = true;
        for (OtaCore.Entry e : rem.files) same &= OtaCore.sha256(new File(dir, e.p)).equals(e.h);
        ok(same && dir.getName().equals(rem.version), "설치 폴더 " + dir.getName() + " · 파일 " + rem.files.size() + "개 sha256 일치");
        ok(new File(dir, "version.json").exists(), "version.json 같이 저장");
        File[] left = root.listFiles(f -> f.getName().startsWith(".tmp"));
        ok(left == null || left.length == 0, "임시 폴더 안 남음");

        System.out.println("3) 깨진 파일 (서버가 다른 내용을 줌)");
        OtaCore.Manifest bad = OtaCore.parse(OtaCore.httpGet(badBase + "version.json", 5000));
        File root2 = new File(root.getParentFile(), "root2");
        try { OtaCore.install(badBase, bad, curM, src, root2, null); ok(false, "설치되면 안 됨"); }
        catch (IOException ex) { ok(ex.getMessage().contains("sha256") || ex.getMessage().contains("크기"), "거절: " + ex.getMessage()); }
        String[] r2 = root2.list();
        ok(r2 == null || r2.length == 0, "실패하면 아무것도 안 남음");

        System.out.println("4) 이상한 경로");
        try { OtaCore.parse("{\"version\":\"9.0.0\",\"native\":1,\"files\":[{\"p\":\"../../evil.so\",\"s\":1,\"h\":\"" + "0".repeat(64) + "\"},{\"p\":\"index.html\",\"s\":1,\"h\":\"" + "0".repeat(64) + "\"}]}"); ok(false, "막아야 함"); }
        catch (IOException ex) { ok(true, "막음: " + ex.getMessage()); }

        System.out.println(fail == 0 ? "모두 통과" : fail + "개 실패");
        System.exit(fail == 0 ? 0 : 1);
    }
}
