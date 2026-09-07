require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name                 = "react-native-hyperswitch-scancard"
  s.version              = package["version"]
  s.summary              = package["description"]
  s.homepage             = package["homepage"]
  s.license              = package["license"]
  s.authors              = package["author"]

  s.platforms            = { :ios => "13.4" }
  s.swift_version        = '5.0'
  s.requires_arc         = true
  s.source               = { :git => "https://github.com/juspay/react-native-hyperswitch-libraries.git", :branch => "main" }
  s.frameworks           = 'Foundation', 'UIKit'
  s.weak_framework       = 'AVKit', 'CoreML', 'VideoToolbox', 'Vision', 'AVFoundation'
  s.source_files         = "ios/Source/**/*.{h,m,mm,swift}"
  s.vendored_frameworks  = "ios/Frameworks/HyperswitchScanCard.xcframework"

  # Wires up React-Core plus, when the consumer enables the new architecture,
  # codegen/Fabric/TurboModule dependencies and compiler flags
  # (RCT_NEW_ARCH_ENABLED). Available on React Native >= 0.71.
  install_modules_dependencies(s)
end
