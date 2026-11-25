require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The minor version of the React Native this app is built with (86 for 0.86.3), or 0 when it cannot
# be found. (Written inline: a method defined at the top of a podspec is not visible inside it.)
react_native_minor =
  begin
    root = Pod::Config.instance.installation_root.to_s
    path = `node --print "require.resolve('react-native/package.json', { paths: ['#{root}'] })" 2>/dev/null`.strip
    version = JSON.parse(File.read(path))["version"]
    version.start_with?("0.0.0-") ? 1000 : version.split(".")[1].to_i
  rescue StandardError
    0
  end

# Does this app get the vault's own engine (each card field a native view)? Only when all hold:
#   - the new architecture is on;
#   - React Native is 0.82 or newer, which is what the bundle is built for;
#   - the app did not opt out with HYPERSWITCH_VAULT_NATIVE_FIELDS=0 when running `pod install`.
# Otherwise the pod compiles a stand-in with no engine and no bundle. The app still builds, and the
# card fields render in plain JavaScript as before.
new_architecture   = react_native_minor >= 82 || ENV["RCT_NEW_ARCH_ENABLED"] == "1"
opted_out          = ENV["HYPERSWITCH_VAULT_NATIVE_FIELDS"] == "0"
hosts_own_engine   = new_architecture && react_native_minor >= 82 && !opted_out

unless hosts_own_engine
  Pod::UI.puts "[@juspay-tech/react-native-hyperswitch-vault] card fields: plain JavaScript in this build " \
    "(new architecture: #{new_architecture}, React Native minor: #{react_native_minor}, opted out: #{opted_out})."
end

Pod::Spec.new do |s|
  s.name         = "react-native-hyperswitch-vault"
  s.version      = package["version"]
  s.summary      = "Hyperswitch card form for React Native: native card fields."
  s.description  = package["description"]
  s.homepage     = "https://github.com/juspay/react-native-hyperswitch"
  s.license      = package["license"]
  s.authors      = "Juspay"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/juspay/react-native-hyperswitch.git", :tag => "#{s.version}" }

  if hosts_own_engine
    # The vault's own engine: the native host, and the bundle it runs.
    s.source_files = "ios/Source/**/*.{h,m,mm}"
    s.resources    = ["ios/Resources/hyperswitch-vault-fields.bundle"]
    # The second host is given the same native modules and views the app links.
    s.dependency "ReactAppDependencyProvider"
    s.dependency "React-RCTAppDelegate"
  elsif new_architecture
    # The three classes React Native's generated code names, doing nothing.
    s.source_files = "ios/Stub/**/*.{h,m,mm}"
  else
    s.source_files = "ios/Empty/**/*.{h,m}"
  end

  install_modules_dependencies(s)
end
