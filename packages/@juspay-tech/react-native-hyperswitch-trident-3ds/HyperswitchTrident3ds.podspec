require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "HyperswitchTrident3ds"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/juspay/react-native-hyperswitch-libraries.git", :branch => "main" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.dependency "Trident3DS"

  install_modules_dependencies(s)
end
