import { useSettingsStore } from "../store";

interface TypeSelectorProps {
  availableTypes: string[];
}

export default function TypeSelector({ availableTypes }: TypeSelectorProps) {
  const { hiddenTypes, toggleType, isTypeVisible } = useSettingsStore();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Show/Hide Types
      </h3>
      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
        {availableTypes.map((type) => (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
          >
            <input
              type="checkbox"
              checked={isTypeVisible(type)}
              onChange={() => toggleType(type)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">{type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
