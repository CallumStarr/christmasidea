package uk.co.christmasidea.santashelper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

public class ManifestPolicyTest {
    private static final String ANDROID_NS = "http://schemas.android.com/apk/res/android";

    private static Document parseSource(String path) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new File("src/main", path));
    }

    @Test
    public void sourcePermissionsPrecedeApplicationAndKeepInternet() throws Exception {
        NodeList children = parseSource("AndroidManifest.xml").getDocumentElement().getChildNodes();
        boolean foundApplication = false;
        int internetPermissions = 0;
        for (int i = 0; i < children.getLength(); i++) {
            Node node = children.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }
            Element element = (Element) node;
            if ("application".equals(element.getTagName())) {
                assertFalse("Only one application element is allowed", foundApplication);
                foundApplication = true;
            } else if ("uses-permission".equals(element.getTagName())) {
                assertFalse("Permissions must precede application", foundApplication);
                if ("android.permission.INTERNET".equals(element.getAttributeNS(ANDROID_NS, "name"))) {
                    internetPermissions++;
                }
            }
        }
        assertTrue("Application must be declared", foundApplication);
        assertEquals("Internet permission must be preserved exactly once", 1, internetPermissions);
    }

    @Test
    public void cloudBackupIsExcludedWithoutChangingTransferDefaults() throws Exception {
        Document manifest = parseSource("AndroidManifest.xml");
        NodeList applications = manifest.getDocumentElement().getElementsByTagName("application");
        assertEquals(1, applications.getLength());
        Element application = (Element) applications.item(0);
        assertEquals("false", application.getAttributeNS(ANDROID_NS, "allowBackup"));
        assertEquals("false", application.getAttributeNS(ANDROID_NS, "usesCleartextTraffic"));
        assertEquals("@xml/data_extraction_rules", application.getAttributeNS(ANDROID_NS, "dataExtractionRules"));
        assertEquals("@xml/legacy_backup_rules", application.getAttributeNS(ANDROID_NS, "fullBackupContent"));

        Element legacy = parseSource("res/xml/legacy_backup_rules.xml").getDocumentElement();
        assertEquals("full-backup-content", legacy.getTagName());
        assertEquals("Legacy file-selection defaults must remain unchanged",
            0, legacy.getElementsByTagName("*").getLength());

        Element rules = parseSource("res/xml/data_extraction_rules.xml").getDocumentElement();
        assertEquals("data-extraction-rules", rules.getTagName());
        Element cloud = null;
        NodeList sections = rules.getChildNodes();
        for (int i = 0; i < sections.getLength(); i++) {
            Node node = sections.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }
            assertEquals("Only cloud rules preserve existing transfer defaults", "cloud-backup", node.getNodeName());
            assertTrue("Only one cloud section is allowed", cloud == null);
            cloud = (Element) node;
        }
        assertNotNull("Cloud backup rules must be present", cloud);

        Set<String> domains = new HashSet<>();
        NodeList entries = cloud.getChildNodes();
        for (int i = 0; i < entries.getLength(); i++) {
            Node node = entries.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }
            assertEquals("Cloud rules must only exclude", "exclude", node.getNodeName());
            Element exclusion = (Element) node;
            assertEquals(".", exclusion.getAttribute("path"));
            assertTrue("Duplicate cloud exclusion", domains.add(exclusion.getAttribute("domain")));
        }
        assertEquals(new HashSet<>(Arrays.asList(
            "root", "file", "database", "sharedpref", "external",
            "device_root", "device_file", "device_database", "device_sharedpref"
        )), domains);
    }
}
