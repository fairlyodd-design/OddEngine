PowerShell hotfix for v10.36.2 Home/Homie Phoenix Daily Truth pass.

Fixes:
- avoids using $home variable name, which conflicts with read-only $HOME on Windows PowerShell
- same patch behavior otherwise
