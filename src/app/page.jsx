"use client";
import React from "react";

function MainComponent() {
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [refreshingKeyword, setRefreshingKeyword] = useState(null);
  const [checkingProgress, setCheckingProgress] = useState({});
  const [selectedDomains, setSelectedDomains] = useState({
    "google.com": true,
    "google.ca": true,
  });
  const [logs, setLogs] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [lastCheckStatus, setLastCheckStatus] = useState({});
  const [showTooltip, setShowTooltip] = useState(null);
  const [rankingHistory, setRankingHistory] = useState({});
  const [showLogs, setShowLogs] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [sortDirection, setSortDirection] = useState("desc");
  const [isBulkChecking, setIsBulkChecking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkKeywords, setBulkKeywords] = useState("");

  const fetchKeywords = useCallback(async () => {
    if (!currentProject) return;

    try {
      const response = await fetch("/api/keywords/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProject.id }),
      });

      if (!response.ok) throw new Error("Failed to fetch keywords");

      const data = await response.json();
      setKeywords(data);
    } catch (err) {
      console.error("Error fetching keywords:", err);
      setErrors((prev) => ({ ...prev, fetch: "Failed to load keywords" }));
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      fetchKeywords();
    }
  }, [currentProject, fetchKeywords]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newWebsite.trim()) return;

    try {
      setLoading(true);
      setErrors({});

      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: newWebsite.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const project = await response.json();

      if (project.error) {
        throw new Error(project.error);
      }

      setCurrentProject(project);
      setNewWebsite("");
    } catch (err) {
      console.error("Error creating project:", err);
      setErrors((prev) => ({
        ...prev,
        project: err.message || "Failed to create project",
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim() || !currentProject) return;

    try {
      setLoading(true);
      setErrors({});

      const response = await fetch("/api/keywords/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          projectId: currentProject.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add keyword");
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setNewKeyword("");
      await fetchKeywords();
    } catch (err) {
      console.error("Error adding keyword:", err);
      setErrors((prev) => ({
        ...prev,
        add: err.message || "Failed to add keyword",
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshRanking = async (keywordId) => {
    const activeDomains = Object.entries(selectedDomains)
      .filter(([_, checked]) => checked)
      .map(([domain]) => domain);

    if (activeDomains.length === 0) {
      setErrors((prev) => ({
        ...prev,
        [keywordId]: "Please select at least one domain",
      }));
      return;
    }

    try {
      setRefreshingKeyword(keywordId);
      setErrors((prev) => ({ ...prev, [keywordId]: null }));

      const response = await fetch("/api/check-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId, domains: activeDomains }),
      });

      if (!response.ok) throw new Error("Failed to check ranking");

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to check ranking");
      }

      await fetchKeywords();
    } catch (err) {
      console.error("Error checking ranking:", err);
      setErrors((prev) => ({ ...prev, [keywordId]: err.message }));
    } finally {
      setRefreshingKeyword(null);
    }
  };

  const handleBulkCheck = async () => {
    const activeDomains = Object.entries(selectedDomains)
      .filter(([_, checked]) => checked)
      .map(([domain]) => domain);

    if (activeDomains.length === 0) {
      setErrors((prev) => ({
        ...prev,
        bulk: "Please select at least one domain",
      }));
      return;
    }

    try {
      setIsBulkChecking(true);
      setBulkProgress(0);
      setErrors({});

      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];

        const response = await fetch("/api/check-ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywordId: keyword.id,
            domains: activeDomains,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to check ranking for keyword ${keyword.id}`);
        }

        setBulkProgress(Math.round(((i + 1) / keywords.length) * 100));

        if (i < keywords.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      await fetchKeywords();
    } catch (err) {
      console.error("Error in bulk check:", err);
      setErrors((prev) => ({ ...prev, bulk: "Bulk check failed" }));
    } finally {
      setIsBulkChecking(false);
      setBulkProgress(0);
    }
  };

  const handleBulkAddKeywords = async () => {
    if (!bulkKeywords.trim()) return;

    const keywordList = bulkKeywords
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordList.length === 0) return;

    try {
      setLoading(true);
      setErrors({});

      for (const keyword of keywordList) {
        const response = await fetch("/api/keywords/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: keyword,
            projectId: currentProject.id,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to add keyword: ${keyword}`);
        }
      }

      setBulkKeywords("");
      setShowBulkAdd(false);
      await fetchKeywords();
    } catch (err) {
      console.error("Error adding keywords:", err);
      setErrors((prev) => ({ ...prev, bulkAdd: "Failed to add keywords" }));
    } finally {
      setLoading(false);
    }
  };

  const sortedKeywords = useMemo(() => {
    return [...keywords].sort((a, b) => {
      const dateA = a.last_checked ? new Date(a.last_checked) : new Date(0);
      const dateB = b.last_checked ? new Date(b.last_checked) : new Date(0);
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [keywords, sortDirection]);

  const getStatusDisplay = (keyword) => {
    if (keyword.google_com_checked_at || keyword.google_ca_checked_at) {
      const hasError =
        keyword.status === "Failed" ||
        keyword.error?.includes("504 Gateway Time-out") ||
        keyword.error?.includes("Gateway timeout");

      if (hasError) {
        return (
          <span className="inline-flex items-center text-red-600">
            <i className="fas fa-exclamation-circle mr-1" />
            Failed
          </span>
        );
      }

      return (
        <span className="inline-flex items-center text-green-600">
          <i className="fas fa-check-circle mr-1" />
          Checked
        </span>
      );
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {!currentProject ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-5xl">⚡</span>
                <h1 className="text-4xl font-bold text-gray-900">
                  SEO Keyword Tracker
                </h1>
              </div>
              <p className="text-xl text-gray-600">
                Track your website's Google rankings for any keyword
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-semibold mb-6">Get Started</h2>
              <form onSubmit={handleCreateProject}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your website URL
                  </label>
                  <input
                    type="text"
                    value={newWebsite}
                    onChange={(e) => setNewWebsite(e.target.value)}
                    placeholder="example.com or https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                    disabled={loading}
                  />
                  {errors.project && (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.project}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !newWebsite.trim()}
                  className="w-full px-6 py-3 bg-[#FFCC00] text-black font-medium rounded-md hover:bg-[#E6B800] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Start Tracking"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <span className="text-3xl">⚡</span>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">
                    SEO Keyword Tracker
                  </h1>
                  <a
                    href={
                      currentProject.website.startsWith("http")
                        ? currentProject.website
                        : `https://${currentProject.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {currentProject.website}
                  </a>
                </div>
              </div>
              <button
                onClick={() => setCurrentProject(null)}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                <i className="fas fa-exchange-alt mr-2" />
                Analyze different domain
              </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Enter a keyword to track..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddKeyword(e);
                      }
                    }}
                  />
                  {errors.add && (
                    <p className="mt-1 text-sm text-red-600">{errors.add}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddKeyword}
                    disabled={loading || !newKeyword.trim()}
                    className="px-6 py-2 bg-[#FFCC00] text-black rounded-md hover:bg-[#E6B800] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 disabled:opacity-50"
                  >
                    Add Keyword
                  </button>
                  <button
                    onClick={() => setShowBulkAdd(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 flex items-center gap-2"
                  >
                    <i className="fas fa-file-import" />
                    Bulk Import
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDomains["google.com"]}
                      onChange={(e) =>
                        setSelectedDomains((prev) => ({
                          ...prev,
                          "google.com": e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-[#FFCC00] focus:ring-[#FFCC00]"
                    />
                    <span className="text-sm text-gray-700">Google.com</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDomains["google.ca"]}
                      onChange={(e) =>
                        setSelectedDomains((prev) => ({
                          ...prev,
                          "google.ca": e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-[#FFCC00] focus:ring-[#FFCC00]"
                    />
                    <span className="text-sm text-gray-700">Google.ca</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {isBulkChecking && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00]/10 text-black rounded-md">
                      <i className="fas fa-spinner fa-spin" />
                      Checking {bulkProgress}%
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <button
                      onClick={handleBulkCheck}
                      disabled={isBulkChecking}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-md hover:bg-[#E6B800] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 disabled:opacity-50"
                    >
                      <i className="fas fa-sync-alt mr-2" />
                      Check All Rankings
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showBulkAdd && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    Bulk Import Keywords
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter one keyword per line
                  </p>
                  <textarea
                    value={bulkKeywords}
                    onChange={(e) => setBulkKeywords(e.target.value)}
                    placeholder="keyword 1&#10;keyword 2&#10;keyword 3"
                    className="w-full h-64 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                    disabled={loading}
                  />
                  {errors.bulkAdd && (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.bulkAdd}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setShowBulkAdd(false);
                        setBulkKeywords("");
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkAddKeywords}
                      disabled={loading || !bulkKeywords.trim()}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-md hover:bg-[#E6B800] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? "Adding..." : "Add Keywords"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {logs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm mb-8">
                <div
                  className="p-4 border-b flex justify-between items-center cursor-pointer"
                  onClick={() => setShowLogs(!showLogs)}
                >
                  <h3 className="text-lg font-medium">Progress Log</h3>
                  <i className={`fas fa-chevron-${showLogs ? "up" : "down"}`} />
                </div>
                {showLogs && (
                  <div className="p-4">
                    <div className="space-y-2 text-sm text-gray-600">
                      {logs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-gray-400">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Keyword
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Google.com Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Google.ca Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() =>
                          setSortDirection((prev) =>
                            prev === "desc" ? "asc" : "desc"
                          )
                        }
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Last Checked
                        <i
                          className={`fas fa-sort-${
                            sortDirection === "desc" ? "down" : "up"
                          }`}
                        />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedKeywords.map((keyword) => (
                    <tr key={keyword.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {keyword.keyword}
                        </div>
                        {errors[keyword.id] && (
                          <div className="text-xs text-red-600 mt-1">
                            {errors[keyword.id]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {keyword.google_com_checked_at ? (
                          keyword.google_com_position ? (
                            <span className="text-green-600">
                              #{keyword.google_com_position}
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              Not in Top 100
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500">No result yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {keyword.google_ca_checked_at ? (
                          keyword.google_ca_position ? (
                            <span className="text-green-600">
                              #{keyword.google_ca_position}
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              Not in Top 100
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500">No result yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusDisplay(keyword)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {keyword.last_checked
                          ? new Date(keyword.last_checked).toLocaleString()
                          : ""}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleRefreshRanking(keyword.id)}
                          disabled={refreshingKeyword === keyword.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-black bg-[#FFCC00]/20 hover:bg-[#FFCC00]/30 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 disabled:opacity-50"
                        >
                          {refreshingKeyword === keyword.id ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-1" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-sync-alt mr-1" />
                              Check Ranking
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {keywords.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        No keywords added yet. Add your first keyword above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MainComponent;