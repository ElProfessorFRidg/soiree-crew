Pod::Spec.new do |s|
  s.name = 'CrewNetworkDiagnostics'
  s.version = '1.0.0'
  s.summary = 'Bounded, credential-free public server diagnostics for Soirée Crew'
  s.description = s.summary
  s.license = 'UNLICENSED'
  s.author = 'Soirée Crew'
  s.homepage = 'https://github.com/ElProfessorFRidg/soiree-crew'
  s.source = { :git => 'https://github.com/ElProfessorFRidg/soiree-crew.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
