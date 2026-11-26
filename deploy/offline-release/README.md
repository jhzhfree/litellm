# 离线拆分发布模板

本目录保存工作区 litellm-release 的可版本化配置，不包含凭据、镜像 tar 或运行数据。

运行 `python init-env.py` 生成测试凭据后，在 `.env` 中设置已经构建并加载的 `PYTHON_IMAGE` 和 `UI_IMAGE`。加载数据库和监控镜像，使用 `docker compose config --quiet` 检查后执行 `docker compose up -d`。

构建脚本使用仓库根目录的 `scripts/build-split.sh`，按 rust、python、ui 顺序构建并推送固定标签。细节见 SPLIT_IMAGES.md。

模板使用 mock 模型，监控只抓取自身。
