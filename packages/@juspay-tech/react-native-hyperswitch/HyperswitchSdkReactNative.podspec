require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# React Native 0.87 removed bridgelessEnabled from the factory delegate (always bridgeless).
react_native_package = `node -p "require.resolve('react-native/package.json', { paths: ['#{__dir__}'] })"`.strip
react_native_major, react_native_minor = JSON.parse(File.read(react_native_package))["version"].split(".").map(&:to_i)
swift_flags = "-enable-experimental-feature AccessLevelOnImport"
swift_flags += " -DHYPERSWITCH_RN_87_PLUS" if react_native_major > 0 || react_native_minor >= 87

Pod::Spec.new do |s|
  s.name         = "HyperswitchSdkReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/juspay/@juspay-tech/react-native-hyperswitch.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/Modules/**/*.{h,m,mm,cpp,swift}",
    "ios/Views/**/*.{h,m,mm,cpp,swift}",
    "ios/hyperswitchSDK/Core/**/*.{h,m,mm,cpp,swift}",
    "ios/hyperswitchSDK/Public/**/*.{h,m,mm,cpp,swift}",
    "ios/hyperswitchSDK/Shared/**/*.{h,m,mm,cpp,swift}",
  ]
  s.public_header_files = [
    "ios/hyperswitchSDK/Public/**/*.h",
  ]
  s.private_header_files = [
    "ios/Modules/**/*.h",
    "ios/Views/**/*.h",
    "ios/hyperswitchSDK/Core/**/*.h",
    "ios/hyperswitchSDK/Shared/**/*.h",
  ]
  s.resources = [
    "ios/hyperswitchSDK/Core/Resources/HyperOTA.plist",
    "ios/hyperswitchSDK/Core/Resources/hyperswitch.bundle",
    "ios/hyperswitchSDK/Core/Resources/hyperswitch-rn82plus.bundle",
  ]
  
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_SWIFT_FLAGS' => swift_flags
  }

  s.dependency 'ReactAppDependencyProvider'
  add_dependency(s, "React-RCTAppDelegate")

  install_modules_dependencies(s)
end
