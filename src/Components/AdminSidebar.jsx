export default function AdminSidebar({ setActiveTab, activeTab }) {
  const menu = [
    { name: "Students", key: "students" },
    { name: "Teachers", key: "teachers" },
    { name: "Notifications", key: "notifications" },
  ];

  return (
    <div className="w-64 bg-white shadow-md h-screen p-4">
      <h2 className="text-2xl font-bold mb-6 text-center">Admin Panel</h2>
      <ul>
        {menu.map((item) => (
          <li
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`p-3 rounded mb-2 cursor-pointer ${
              activeTab === item.key ? "bg-blue-500 text-white" : "hover:bg-gray-100"
            }`}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
