require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

Pod::Spec.new do |s|
  s.name                 = "react-native-hyperswitch-scancard"
  s.version              = package["version"]
  s.summary              = package["description"]
  s.homepage             = package["homepage"]
  s.license              = package["license"]
  s.authors              = package["author"]

  s.platforms            = { :ios => "13.0" }
  s.swift_version        = '5.0'
  s.requires_arc         = true
  s.source               = { :git => "https://github.com/juspay/react-native-hyperswitch-libraries.git", :branch => "main" }
  s.frameworks           = 'Foundation', 'UIKit'
  s.weak_framework       = 'AVKit', 'CoreML', 'VideoToolbox', 'Vision', 'AVFoundation'
  s.source_files         = "ios/Source/**/*.{h,m,mm,swift}"
  s.vendored_frameworks  = "ios/Frameworks/HyperswitchScanCard.xcframework"

  s.dependency "React-Core"

  # Don't install the dependencies when we run `pod install` in the old architecture.
  if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
    s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
    s.pod_target_xcconfig    = {
        "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
        "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
    }

    s.dependency "React-Codegen"
    s.dependency "RCT-Folly"
    s.dependency "RCTRequired"
    s.dependency "RCTTypeSafety"
    s.dependency "ReactCommon/turbomodule/core"
  end
end
