Trading panel source cleanup recode pass.

This pass removes duplicated helper blocks accidentally injected into chart, bar chart, drawer list, drawer, and table-row render paths. It also fixes selectedContractKey UI state hydration. The goal is to restore a stable Trading panel base after multiple layered hotfixes.
