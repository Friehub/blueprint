#!/usr/bin/env bash

_blueprinter() {
  local cur prev commands global_opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  commands="build list inspect graph resolve"
  global_opts="--root --strict --output --help --version --quiet --compact"

  if [[ ${cur} == -* ]]; then
    case "${COMP_WORDS[1]}" in
      resolve)
        COMPREPLY=( $(compgen -W "${global_opts} --modules" -- "${cur}") )
        ;;
      inspect|graph)
        COMPREPLY=( $(compgen -W "${global_opts} --format" -- "${cur}") )
        ;;
      *)
        COMPREPLY=( $(compgen -W "${global_opts}" -- "${cur}") )
        ;;
    esac
    return 0
  fi

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands}" -- "${cur}") )
    return 0
  fi

  if [[ ${prev} == --format ]]; then
    COMPREPLY=( $(compgen -W "ascii mermaid" -- "${cur}") )
    return 0
  fi

  if [[ ${prev} == --root || ${prev} == --output ]]; then
    COMPREPLY=( $(compgen -f -- "${cur}") )
    return 0
  fi

  if [[ ${prev} == --modules ]]; then
    return 0
  fi

  if [[ ${COMP_WORDS[1]} == inspect || ${COMP_WORDS[1]} == graph ]]; then
    if [[ ${COMP_CWORD} -eq 2 ]]; then
      local modules=""
      if [[ -d "contracts" ]]; then
        modules=$(find contracts -maxdepth 1 -name "*.md" -not -path "*/core/*" -exec basename {} .md \; 2>/dev/null | tr '\n' ' ')
      fi
      COMPREPLY=( $(compgen -W "${modules}" -- "${cur}") )
      return 0
    fi
  fi
}

complete -F _blueprinter blueprinter
