require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name                 = "react-native-hyperswitch-airborne"
  s.version              = package["version"]
  s.summary              = package["description"]
  s.homepage             = package["homepage"]
  s.license              = package["license"]
  s.authors              = package["author"]

  s.platforms            = { :ios => "13.4" }
  s.swift_version        = '5.0'
  s.requires_arc         = true
  s.source               = { :git => "https://github.com/juspay/react-native-hyperswitch.git", :branch => "main" }
  s.source_files         = "ios/**/*.{h,m,mm,swift}"

  s.dependency 'hyperswitch-sdk-ios/airborne', '= 0.4.4.patch2'

  install_modules_dependencies(s)
end
