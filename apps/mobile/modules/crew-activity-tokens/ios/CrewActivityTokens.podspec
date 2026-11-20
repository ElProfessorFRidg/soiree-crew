Pod::Spec.new do |s|
  s.name           = 'CrewActivityTokens'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit push token observation for Soirée Crew'
  s.description    = 'Requests push-enabled Live Activities and streams their ActivityKit tokens to JavaScript.'
  s.author         = 'Soiree Crew'
  s.homepage       = 'https://github.com/ElProfessorFRidg/soiree-crew'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.2' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = '**/*.swift'
end
