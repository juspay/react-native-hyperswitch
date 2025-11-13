require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Read provider configuration from consumer app's package.json
# Use CocoaPods installation_root to reliably find the project root
provider = 'core'

begin
  # Get the project root (where Podfile is located) and go up one level to find package.json
  project_root = Pod::Config.instance.installation_root
  app_package_path = File.join(project_root, "..", "package.json")
  
  if File.exist?(app_package_path)
    app_package = JSON.parse(File.read(app_package_path))
    provider = app_package.dig('hyperswitch', 'ios', 'authProvider') || 'core'
  end
rescue => e
  # Fallback to 'core' if there's any error reading the configuration
  provider = 'core'
end

Pod::Spec.new do |s|
  s.name         = "Hyperswitch3ds"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => ".git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  if provider == 'netcetera'
    s.dependency "hyperswitch-sdk-ios-authentication/netcetera3ds"
  elsif provider == 'trident'
    s.dependency "hyperswitch-sdk-ios-authentication/trident"
  elsif provider == 'cardinal'
    s.dependency "hyperswitch-sdk-ios-authentication/cardinal"
  else
    s.dependency "hyperswitch-sdk-ios-authentication"
  end

# Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
# See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
if respond_to?(:install_modules_dependencies, true)
  install_modules_dependencies(s)
else
  s.dependency "React-Core"
end
end
