const extractCategoryTokens = (str) => {
    const stopWords = new Set(['practical', 'driving', 'course', 'pdc', 'tdc', 'theoretical', 'dc', 'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'to']);
    return str.toLowerCase().replace(/[()[\]{}'"%]/g, ' ').split(/[\s\-\/,;|&+]+/).filter(t => t.length >= 2 && !stopWords.has(t));
};
console.log(extractCategoryTokens('Practical Driving Course(PDC) - (MOTORCYCLE)'));
console.log(extractCategoryTokens('Practical Driving Course (PDC) - Motorcycle'));
console.log(extractCategoryTokens('Practical Driving Course (PDC) - Car (MT)'));
