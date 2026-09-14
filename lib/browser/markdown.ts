
export const downloadMarkdown = (md: string) => {
  const element = document.createElement('a');
  const file = new Blob([md], { type: 'text/markdown' });
  element.href = URL.createObjectURL(file);
  element.download = `ai_cut_analysis_${Date.now()}.md`;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
};
