Pod::Spec.new do |s|
  s.name = 'CrewActivityTokens'
  s.version = '1.0.0'
  s.summary = 'ActivityKit push token observation for Soirée Crew'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Soiree Crew'
  s.homepage = 'https://github.com/ElProfessorFRidg/soiree-crew'
  s.platforms = { :ios => '16.2' }
  s.source = { :git => 'https://github.com/ElProfessorFRidg/soiree-crew.git' }
  s.source_files = 'ios/**/*.{swift,h,m}'
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
end
