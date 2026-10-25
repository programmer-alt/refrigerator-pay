# Правила Bash-команд на Windows

## ⚠️ Критическое правило

**На Windows (win32) НЕ используй `Bash` инструмент с Unix-командами.**
Всегда используй `powershell -Command` вместо `Bash`.

---

## ❌ Плохо (не работает)

```bash
# Bash инструмент на Windows — криво работает
mkdir "path/to/dir"
rm -rf "path"
cat file.txt
grep "pattern" file.txt
ls -la
```

**Почему не работает:**
- Bash-инструмент на Windows использует `uv_spawn` для запуска команд
- `mkdir`, `rm`, `cat`, `grep` — Unix-команды, которых нет в PowerShell нативно
- PowerShell делает их алиасами, но обёртка `uv_spawn` не правильно передаёт пути и аргументы
- Результат: `EPERM: operation not permitted`

---

## ✅ Хорошо (работает)

```powershell
# PowerShell нативные команды
powershell -Command "New-Item -ItemType Directory -Force -Path 'D:\path\to\dir'"
powershell -Command "Remove-Item -Recurse -Force 'D:\path'"
powershell -Command "Get-Content 'D:\path\file.txt'"
powershell -Command "Select-String -Pattern 'text' -Path 'D:\path\file.txt'"
powershell -Command "Get-ChildItem -Path 'D:\path'"
```

---

## 📋 Шпаргалка команд

| Unix-команда | PowerShell-аналог |
|---|---|
| `mkdir dir` | `New-Item -ItemType Directory -Force -Path 'dir'` |
| `rm -rf dir` | `Remove-Item -Recurse -Force 'dir'` |
| `rm file` | `Remove-Item 'file'` |
| `cat file` | `Get-Content 'file'` |
| `echo "text"` | `Write-Output "text"` |
| `ls -la` | `Get-ChildItem -Force` |
| `grep "pattern" file` | `Select-String -Pattern "pattern" -Path "file"` |
| `cp src dest` | `Copy-Item -Path 'src' -Destination 'dest'` |
| `mv src dest` | `Move-Item -Path 'src' -Destination 'dest'` |
| `which command` | `Get-Command command` |
| `pwd` | `Get-Location` |
| `export VAR=val` | `$env:VAR = "val"` |
| `chmod +x file` | `icacls 'file' /grant Everyone:F` |

---

## 🔑 Правила

1. **Всегда используй `powershell -Command "..."`** для Bash-инструмента на Windows
2. **Кавычки внутри кавычек** — экранируй или используй одинарные внутри двойных:
   ```powershell
   powershell -Command "Get-Content 'D:\path\file.txt'"  # ✅
   powershell -Command 'Get-Content "D:\path\file.txt"'  # ✅
   ```
3. **Пути с пробелами** — всегда в кавычках:
   ```powershell
   powershell -Command "New-Item -ItemType Directory -Force -Path 'D:\my path\dir'"  # ✅
   ```
4. **Многострочные команды** — используй `;` вместо `\n`:
   ```powershell
   powershell -Command "cd 'D:\path'; Get-ChildItem"  # ✅
   ```

---

## 💡 Альтернатива

**Предпочитай специализированные инструменты Bash:**
- `Glob` вместо `ls` и `find`
- `Grep` вместо `grep` и `rg`
- `Read` вместо `cat` и `head`
- `Edit` вместо `sed` и `awk`
- `Write` вместо `echo >` и `cat <<EOF`

**Bash-инструмент используй только для:**
- `git` команд
- `npm` / `yarn` / `pnpm` команд
- `docker` команд
- Специфичных команд, которые нет в других инструментах
