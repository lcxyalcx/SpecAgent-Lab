export type StorageTarget = "database" | "file" | "mixed" | "none";

export type StorageInfo = {
  target: StorageTarget;
  label: string;
  message: string | null;
  ephemeral: boolean;
};

function isEphemeralFileStorage() {
  return process.env.VERCEL === "1";
}

function defaultFileMessage(ephemeral: boolean) {
  return ephemeral
    ? "当前结果已回退保存到运行实例的临时文件。在当前实例存活期间，/runs/[id] 与结果总览仍可继续查看；实例重启或扩缩容后，这些记录可能丢失。"
    : "当前结果已回退保存到项目本地文件。即使没有 PostgreSQL，也可以继续在 /runs/[id] 与结果总览中查看历史记录。";
}

export function buildStorageInfo(
  target: StorageTarget,
  message?: string | null,
): StorageInfo {
  const ephemeral = target === "file" || target === "mixed"
    ? isEphemeralFileStorage()
    : false;

  if (target === "database") {
    return {
      target,
      label: "数据库",
      message:
        message ??
        "当前结果已保存到数据库，可直接在 /runs/[id] 和结果总览中继续查看。",
      ephemeral: false,
    };
  }

  if (target === "file") {
    return {
      target,
      label: ephemeral ? "临时文件" : "本地文件",
      message: message ?? defaultFileMessage(ephemeral),
      ephemeral,
    };
  }

  if (target === "mixed") {
    return {
      target,
      label: ephemeral ? "数据库 + 临时文件" : "数据库 + 本地文件",
      message:
        message ??
        `本次结果部分写入数据库，部分因数据库异常回退到${ephemeral ? "临时文件" : "本地文件"}。`,
      ephemeral,
    };
  }

  return {
    target: "none",
    label: "未保存",
    message: message ?? "当前结果未能成功持久化，刷新后可能丢失。",
    ephemeral: false,
  };
}
