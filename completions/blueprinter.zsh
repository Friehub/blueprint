#compdef blueprinter

_blueprinter() {
  local -a commands
  commands=(
    'build:Load all contracts and output catalog.json'
    'list:List all modules with dependencies'
    'inspect:Show full contract for a module'
    'graph:Show dependency graph for a module'
    'resolve:Resolve specific modules with dependencies'
  )

  _arguments -C \
    '1:command:->command' \
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        resolve)
          _arguments \
            '--modules[Comma-separated module names]:modules:_nothing' \
            '--root[Project root directory]:directory:_directories' \
            '--output[Write output to file]:file:_files' \
            '--compact[Output compact JSON]' \
            '--quiet[Suppress warnings]' \
            '--strict[Exit on errors]' \
            '--help[Show help]'
          ;;
        inspect|graph)
          local -a module_names
          if [[ -d "contracts" ]]; then
            module_names=(${(f)"$(find contracts -maxdepth 1 -name '*.md' -not -path '*/core/*' -exec basename {} .md \; 2>/dev/null)"})
          fi
          _arguments \
            '1:module:->module' \
            '--format[Output format]:format:(ascii mermaid)' \
            '--root[Project root directory]:directory:_directories' \
            '--output[Write output to file]:file:_files' \
            '--compact[Output compact JSON]' \
            '--strict[Exit on errors]' \
            '--help[Show help]'
          case $state in
            module)
              _describe 'module' module_names
              ;;
          esac
          ;;
        list|build)
          _arguments \
            '--root[Project root directory]:directory:_directories' \
            '--output[Write output to file]:file:_files' \
            '--compact[Output compact JSON]' \
            '--quiet[Suppress warnings]' \
            '--strict[Exit on errors]' \
            '--help[Show help]'
          ;;
      esac
      ;;
  esac
}

_blueprinter "$@"
