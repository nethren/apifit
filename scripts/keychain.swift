import Foundation
import AppKit
import Security
import LocalAuthentication

// A fixed, APIFit-only item. Secrets never enter argv, environment or a browser.
let service = "com.apifit.local.anthropic"
let account = "api-key"
let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service, kSecAttrAccount as String: account]
func stop(_ message: String, _ code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8)); exit(code)
}
let command = CommandLine.arguments.dropFirst().first ?? "status"
switch command {
case "status":
    var attributes = query
    attributes[kSecReturnAttributes as String] = true
    let context = LAContext()
    context.interactionNotAllowed = true
    attributes[kSecUseAuthenticationContext as String] = context
    let status = SecItemCopyMatching(attributes as CFDictionary, nil)
    if status == errSecSuccess { print("stored") }
    else if status == errSecItemNotFound { print("missing") }
    else { print("locked-or-unavailable") }
case "store":
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let alert = NSAlert()
    alert.messageText = "Save a NEW Anthropic key for APIFit"
    alert.informativeText = "First revoke the key you pasted into chat. Paste its replacement here. It is saved only in your Mac's Keychain, not chat, source files or browser storage. This does not make a paid API call."
    alert.addButton(withTitle: "Save to Keychain")
    alert.addButton(withTitle: "Cancel")
    let field = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 400, height: 28))
    field.placeholderString = "Replacement Anthropic API key"
    alert.accessoryView = field
    alert.window.initialFirstResponder = field
    app.activate(ignoringOtherApps: true)
    guard alert.runModal() == .alertFirstButtonReturn else { stop("Key setup cancelled. Nothing stored.", 2) }
    var key = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    field.stringValue = ""
    guard key.hasPrefix("sk-ant-"), key.count >= 40, key.count <= 300,
          key.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
        stop("That is not a supported Anthropic API-key format. Nothing stored.")
    }
    let data = Data(key.utf8)
    key = ""
    var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecItemNotFound {
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrLabel as String] = "APIFit — Anthropic API key"
        item[kSecAttrSynchronizable as String] = false
        status = SecItemAdd(item as CFDictionary, nil)
    }
    guard status == errSecSuccess else { stop("Keychain could not save the key. Nothing was printed or written to a file.") }
    print("stored")
case "read":
    // The backend consumes this pipe. Other processes owned by this user remain trusted.
    guard isatty(STDOUT_FILENO) == 0 else { stop("Refusing to display a credential in a terminal.") }
    var request = query
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data else { stop("APIFit's Keychain item is missing or locked.") }
    FileHandle.standardOutput.write(data)
default:
    stop("Unsupported APIFit Keychain command.")
}
