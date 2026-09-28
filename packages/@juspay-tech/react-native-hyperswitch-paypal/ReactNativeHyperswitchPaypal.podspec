require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeHyperswitchPaypal"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/juspay/react-native-hyperswitch.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  install_modules_dependencies(s)

  s.dependency "PayPal/CardPayments", "~> 2.0"
  s.dependency "PayPal/PaymentButtons", "~> 2.0"
  s.dependency "PayPal/PayPalWebPayments", "~> 2.0"
end
