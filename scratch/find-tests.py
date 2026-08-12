import json

log_path = r"C:\Users\ys070\.gemini\antigravity\brain\09d9752f-a38b-4711-a3d1-7c4bb6664cbc\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            tool_calls = step.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name', '')
                args = tc.get('args', {})
                if 'run_command' in name or 'write_to_file' in name:
                    args_str = str(args)
                    if 'test' in args_str.lower() or 'ts-node' in args_str.lower():
                        print(f"Step {step.get('step_index')}: {name} -> {args_str[:300]}")
        except Exception as e:
            pass
