const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(origin.startsWith('http://localhost:')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

async function scrapeGoogleScholar(startIndex = 0, pageSize = 100) {
  const url = `https://scholar.google.com.br/citations?hl=en&user=RgcMUu4AAAAJ&view_op=list_works&sortby=pubdate&cstart=${startIndex}&pagesize=${pageSize}`;
  console.log('Fetching URL:', url);
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const articles = [];
  $('#gsc_a_b .gsc_a_tr').each((i, elem) => {
    const $elem = $(elem);
    const title = $elem.find('.gsc_a_t a').text().trim();
    const authors = $elem.find('.gsc_a_t .gs_gray').first().text().trim();
    const publication = $elem.find('.gsc_a_t .gs_gray').last().text().trim();
    const year = $elem.find('.gsc_a_y').text().trim();
    const citations = $elem.find('.gsc_a_c').text().trim();

    // Only add the article if it has a title (to filter out empty entries)
    if (title) {
      articles.push({ title, authors, publication, year, citations });
    }
  });

  return articles;
}

app.post('/api/scrape-google-scholar', async (req, res) => {
  try {
    console.log('Starting Google Scholar scraping...');
    let allArticles = [];
    let startIndex = 0;
    const pageSize = 100;
    const maxResults = 300;

    while (allArticles.length < maxResults) {
      const articles = await scrapeGoogleScholar(startIndex, pageSize);
      if (articles.length === 0) break;
      
      // Filter out duplicates based on title
      const newArticles = articles.filter(article => 
        !allArticles.some(existingArticle => existingArticle.title === article.title)
      );
      
      allArticles = allArticles.concat(newArticles);
      console.log(`Scraped ${allArticles.length} unique articles so far...`);

      if (newArticles.length === 0) break; // If no new articles were added, we've reached the end
      
      startIndex += pageSize;

      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.log('Fetching profile data...');
    const profileResponse = await axios.get(`https://scholar.google.com.br/citations?hl=en&user=RgcMUu4AAAAJ`);
    const $ = cheerio.load(profileResponse.data);

    const scholarData = {
      name: $('#gsc_prf_in').text().trim(),
      affiliation: $('.gsc_prf_il').first().text().trim(),
      hIndex: $('#gsc_rsb_st .gsc_rsb_std').eq(2).text().trim(),
      i10Index: $('#gsc_rsb_st .gsc_rsb_std').eq(5).text().trim(),
      citations: $('#gsc_rsb_st .gsc_rsb_std').first().text().trim(),
      articles: allArticles,
      lastUpdated: new Date().toISOString()
    };

    console.log('Saving data to file...');
    await fs.writeFile(path.join(__dirname, 'scholar_data.json'), JSON.stringify(scholarData, null, 2));

    console.log(`Scraped ${allArticles.length} unique articles and saved to scholar_data.json`);
    res.json(scholarData);
  } catch (error) {
    console.error('Error scraping Google Scholar:', error);
    res.status(500).json({ error: 'Failed to scrape Google Scholar', details: error.message });
  }
});

app.get('/api/get-scholar-data', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'scholar_data.json');
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.json({});
    }

    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading scholar data:', error);
    res.status(500).json({ 
      error: 'Failed to read scholar data', 
      details: error.message,
      stack: error.stack
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});




















